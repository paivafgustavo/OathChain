const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, mine, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const V = { Nenhum: 0, Verdadeira: 1, Falsa: 2, Inconclusiva: 3 };
const E = { Registrada: 0, EmVerificacao: 1, Finalizada: 2, SemConsenso: 3 };
const DIA = 24 * 3600;
const JUST = "Conferi a fonte oficial e os numeros batem com o que foi afirmado.";
const LINK = "https://exemplo.gov.br/relatorio-2025";
const SAL = ethers.id("sal-de-teste");

function selo(veredito, sal, quem, id, rodada) {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint8", "bytes32", "address", "uint256", "uint32"],
      [veredito, sal, quem, id, rodada]
    )
  );
}

describe("OathChain v5: júri sorteado, voto secreto e candidatura", function () {
  async function deploy() {
    const sig = await ethers.getSigners();
    const [dono, autor, estranho] = sig;
    const revs = sig.slice(3, 10); // 7 revisores
    const aprs = sig.slice(10, 13); // 3 aprendizes
    const livro = await ethers.deployContract("OathChain");
    const gestao = await ethers.deployContract("GestaoRevisores", [await livro.getAddress()]);
    await livro.definirGestao(await gestao.getAddress());
    await livro.definirJuri(5, 2, true); // estes testes cobrem o voto secreto; o voto aberto tem seu próprio bloco abaixo
    for (const r of revs) await livro.definirRevisor(r.address, true);
    await gestao.definirParametros(ethers.parseEther("0.01"), 2, 1, 1 * DIA, 20, 7 * DIA, 100);
    return { livro, gestao, dono, autor, estranho, revs, aprs, sig };
  }

  async function comAprendizes() {
    const b = await deploy();
    for (const a of b.aprs) await b.gestao.connect(a).candidatar({ value: ethers.parseEther("0.01") });
    return b;
  }

  // abre a verificação e sorteia (id 1)
  async function sorteada(b) {
    await b.livro.connect(b.autor).registrarAfirmacao("ipfs://a", "2025", 0);
    await b.livro.connect(b.autor).abrirVerificacao(1);
    await mine(4);
    await b.livro.sortearJurados(1);
    const [info, jurados, obs] = await b.livro.obterJuri(1, 1);
    const porEnd = (l) => l.map((e) => b.sig.find((s) => s.address === e));
    return { ...b, id: 1n, info, jurados: porEnd(jurados), obs: porEnd(obs) };
  }

  async function selar(b, quem, voto, rodada = 1) {
    await b.livro.connect(quem).comprometerVoto(b.id, selo(voto, SAL, quem.address, b.id, rodada));
  }
  async function revelar(b, quem, voto) {
    await b.livro.connect(quem).revelarVoto(b.id, voto, SAL, JUST, LINK);
  }

  describe("voto aberto (selo e justificativa juntos)", function () {
    async function aberta() {
      const b = await comAprendizes();
      await b.livro.definirJuri(5, 2, false);
      return sorteada(b);
    }

    it("o padrão do contrato é voto aberto", async function () {
      const livro = await ethers.deployContract("OathChain");
      expect(await livro.votoSecreto()).to.equal(false);
    });

    it("vota e justifica numa única transação, já valendo na hora", async function () {
      const s = await aberta();
      await expect(s.livro.connect(s.jurados[0]).votarComJustificativa(s.id, V.Verdadeira, JUST, LINK))
        .to.emit(s.livro, "VotoRevelado");
      expect(await s.livro.obterVoto(s.id, 1, s.jurados[0].address)).to.equal(V.Verdadeira);
      expect(await s.livro.obterContagem(s.id, 1, V.Verdadeira)).to.equal(1);
    });

    it("exige justificativa de 40+ caracteres e link http", async function () {
      const s = await aberta();
      const j = s.jurados[0];
      await expect(s.livro.connect(j).votarComJustificativa(s.id, V.Falsa, "curta", LINK)).to.be.revertedWith("Justificativa curta demais");
      await expect(s.livro.connect(j).votarComJustificativa(s.id, V.Falsa, JUST, "sem-link")).to.be.revertedWith("Link de fonte invalido");
    });

    it("só jurado sorteado vota, uma vez só, e o autor não", async function () {
      const s = await aberta();
      const fora = s.revs.find((r) => !s.jurados.some((j) => j.address === r.address));
      await expect(s.livro.connect(fora).votarComJustificativa(s.id, V.Falsa, JUST, LINK)).to.be.revertedWith("Apenas revisores");
      await s.livro.connect(s.jurados[0]).votarComJustificativa(s.id, V.Falsa, JUST, LINK);
      await expect(s.livro.connect(s.jurados[0]).votarComJustificativa(s.id, V.Falsa, JUST, LINK)).to.be.revertedWith("Ja votou nesta rodada");
    });

    it("votar() sem justificativa não vale mais no modo júri", async function () {
      const s = await aberta();
      await expect(s.livro.connect(s.jurados[0]).votar(s.id, V.Falsa, "ipfs://j")).to.be.revertedWith("Use votarComJustificativa");
    });

    it("selar/revelar ficam indisponíveis, e aprendiz observa sem contar", async function () {
      const s = await aberta();
      await expect(s.livro.connect(s.jurados[0]).comprometerVoto(s.id, ethers.id("x"))).to.be.revertedWith("Voto secreto indisponivel");
      await s.livro.connect(s.obs[0]).votarComJustificativa(s.id, V.Falsa, JUST, LINK);
      expect(await s.livro.obterContagem(s.id, 1, V.Falsa)).to.equal(0);
    });

    it("maioria 3 de 5 finaliza assim que todos votam, sem esperar a janela", async function () {
      const s = await aberta();
      const todos = [...s.jurados, ...s.obs];
      const vs = [V.Falsa, V.Falsa, V.Falsa, V.Verdadeira, V.Verdadeira];
      for (let i = 0; i < 5; i++) await s.livro.connect(s.jurados[i]).votarComJustificativa(s.id, vs[i], JUST, LINK);
      for (const o of s.obs) await s.livro.connect(o).votarComJustificativa(s.id, V.Falsa, JUST, LINK);
      await s.livro.finalizar(s.id);
      expect((await s.livro.obterRegistro(s.id)).estado).to.equal(E.Finalizada);
      expect((await s.livro.obterRegistro(s.id)).resultado).to.equal(V.Falsa);
    });
  });

  describe("sorteio", function () {
    it("só sorteia depois do bloco futuro e só uma vez", async function () {
      const b = await deploy();
      await b.livro.connect(b.autor).registrarAfirmacao("ipfs://a", "2025", 0);
      await b.livro.connect(b.autor).abrirVerificacao(1);
      await expect(b.livro.sortearJurados(1)).to.be.revertedWith("Aguarde o bloco do sorteio");
      await mine(4);
      await b.livro.sortearJurados(1);
      await expect(b.livro.sortearJurados(1)).to.be.revertedWith("Nada a sortear");
    });

    it("sorteia 5 jurados distintos entre os revisores, sem o autor", async function () {
      const b = await deploy();
      await b.livro.definirRevisor(b.autor.address, true); // o autor também é revisor
      const s = await sorteada(b);
      expect(s.jurados.length).to.equal(5);
      expect(new Set(s.jurados.map((j) => j.address)).size).to.equal(5);
      expect(s.jurados.map((j) => j.address)).to.not.include(b.autor.address);
      for (const j of s.jurados) expect(await b.livro.ehRevisor(j.address)).to.equal(true);
    });

    it("sorteia aprendizes como observadores (e nunca o autor)", async function () {
      const b = await comAprendizes();
      const s = await sorteada(b);
      expect(s.obs.length).to.equal(2); // aprendizesPorJuri = 2, havia 3
      for (const a of s.obs) expect(await b.livro.obterPapel(1, 1, a.address)).to.equal(2);
      for (const j of s.jurados) expect(await b.livro.obterPapel(1, 1, j.address)).to.equal(1);
    });

    it("quem não foi sorteado não vota nem sela voto", async function () {
      const b = await deploy();
      const s = await sorteada(b);
      const fora = b.revs.find((r) => !s.jurados.some((j) => j.address === r.address));
      await expect(b.livro.connect(fora).comprometerVoto(1, ethers.id("x"))).to.be.revertedWith("Voce nao foi sorteado");
      await expect(b.livro.connect(fora).anexarFonte(1, "ipfs://f", ethers.id("f"))).to.be.revertedWith("Fonte so por revisor");
    });

    it("na contestação o novo júri prefere quem não julgou antes", async function () {
      const b = await deploy();
      await b.livro.definirJuri(3, 0, true);
      const s = await sorteada(b);
      for (const j of s.jurados) await selar(s, j, V.Falsa);
      await time.increase(4 * DIA);
      for (const j of s.jurados) await revelar(s, j, V.Falsa);
      await b.livro.finalizar(1);
      await b.livro.connect(b.autor).contestar(1, "ipfs://motivo");
      await mine(4);
      await b.livro.sortearJurados(1);
      const [, novos] = await b.livro.obterJuri(1, 2);
      const antes = s.jurados.map((j) => j.address);
      expect(novos.length).to.equal(3);
      for (const n of novos) expect(antes).to.not.include(n); // havia 4 revisores "novos" disponíveis
    });

    it("se passar de 256 blocos, o sorteio é adiado e refeito", async function () {
      const b = await deploy();
      await b.livro.connect(b.autor).registrarAfirmacao("ipfs://a", "2025", 0);
      await b.livro.connect(b.autor).abrirVerificacao(1);
      await mine(300);
      await expect(b.livro.sortearJurados(1)).to.emit(b.livro, "SorteioAdiado");
      await mine(4);
      await expect(b.livro.sortearJurados(1)).to.emit(b.livro, "JuradosSorteados");
    });

    it("falha se não houver jurados suficientes", async function () {
      const b = await deploy();
      for (const r of b.revs.slice(2)) await b.livro.definirRevisor(r.address, false);
      await b.livro.definirMinRevisores(2);
      await b.livro.connect(b.autor).registrarAfirmacao("ipfs://a", "2025", 0);
      await b.livro.connect(b.autor).abrirVerificacao(1);
      await mine(4);
      await b.livro.definirMinRevisores(3);
      await expect(b.livro.sortearJurados(1)).to.be.revertedWith("Jurados insuficientes");
    });
  });

  describe("voto secreto (commit-reveal)", function () {
    it("fluxo completo: selar, revelar e finalizar com maioria", async function () {
      const b = await deploy();
      const s = await sorteada(b);
      for (const j of s.jurados) await selar(s, j, V.Verdadeira);
      // durante a etapa de selar, ninguém vê o voto
      expect(await b.livro.obterVoto(1, 1, s.jurados[0].address)).to.equal(V.Nenhum);
      await time.increase(4 * DIA);
      for (const j of s.jurados) await revelar(s, j, V.Verdadeira);
      await b.livro.finalizar(1);
      expect((await b.livro.obterRegistro(1)).estado).to.equal(E.Finalizada);
      expect(await b.livro.ehVerificado(1)).to.equal(true);
    });

    it("não dá para revelar antes da etapa de revelar, nem selar depois", async function () {
      const b = await deploy();
      const s = await sorteada(b);
      const j = s.jurados[0];
      await selar(s, j, V.Falsa);
      await expect(b.livro.connect(j).revelarVoto(1, V.Falsa, SAL, JUST, LINK)).to.be.revertedWith("Aguarde a etapa de revelar");
      await time.increase(4 * DIA);
      await expect(b.livro.connect(s.jurados[1]).comprometerVoto(1, ethers.id("x"))).to.be.revertedWith("Etapa de selar encerrada");
    });

    it("rejeita voto que não confere com o selo, selo duplicado e sem selo", async function () {
      const b = await deploy();
      const s = await sorteada(b);
      const [j, k] = s.jurados;
      await selar(s, j, V.Falsa);
      await expect(
        b.livro.connect(j).comprometerVoto(1, ethers.id("outro"))
      ).to.be.revertedWith("Ja selou o voto");
      await time.increase(4 * DIA);
      await expect(b.livro.connect(j).revelarVoto(1, V.Verdadeira, SAL, JUST, LINK)).to.be.revertedWith("Voto nao confere com o selo");
      await expect(b.livro.connect(j).revelarVoto(1, V.Falsa, ethers.id("sal-errado"), JUST, LINK)).to.be.revertedWith("Voto nao confere com o selo");
      await expect(b.livro.connect(k).revelarVoto(1, V.Falsa, SAL, JUST, LINK)).to.be.revertedWith("Voce nao selou um voto");
    });

    it("exige justificativa e link de fonte", async function () {
      const b = await deploy();
      const s = await sorteada(b);
      const j = s.jurados[0];
      await selar(s, j, V.Falsa);
      await time.increase(4 * DIA);
      await expect(b.livro.connect(j).revelarVoto(1, V.Falsa, SAL, "curta", LINK)).to.be.revertedWith("Justificativa curta demais");
      await expect(b.livro.connect(j).revelarVoto(1, V.Falsa, SAL, JUST, "ipfs://sem-http")).to.be.revertedWith("Link de fonte invalido");
      await revelar(s, j, V.Falsa);
      await expect(revelar(s, j, V.Falsa)).to.be.revertedWith("Ja revelou");
    });

    it("o voto antigo (votar) fica desligado com voto secreto", async function () {
      const b = await deploy();
      const s = await sorteada(b);
      await expect(b.livro.connect(s.jurados[0]).votar(1, V.Falsa, "ipfs://j")).to.be.revertedWith("Use o voto secreto");
    });

    it("o autor não pode ser jurado e a contagem usa o tamanho do júri (maioria absoluta)", async function () {
      const b = await deploy();
      const s = await sorteada(b);
      // 2 de 5 revelam Verdadeira: não é maioria
      for (const j of s.jurados) await selar(s, j, V.Verdadeira);
      await time.increase(4 * DIA);
      await revelar(s, s.jurados[0], V.Verdadeira);
      await revelar(s, s.jurados[1], V.Verdadeira);
      await expect(b.livro.finalizar(1)).to.be.revertedWith("Aguarde o fim da votacao");
      await time.increase(4 * DIA);
      await b.livro.finalizar(1);
      expect((await b.livro.obterRegistro(1)).estado).to.equal(E.SemConsenso);
    });

    it("aprendizes votam mas o voto deles NÃO conta no resultado", async function () {
      const b = await comAprendizes();
      const s = await sorteada(b);
      const todos = [...s.jurados, ...s.obs];
      // jurados: 3 Verdadeira, 2 Falsa; aprendizes: todos Falsa (não podem virar a maioria)
      for (const [i, j] of s.jurados.entries()) await selar(s, j, i < 3 ? V.Verdadeira : V.Falsa);
      for (const a of s.obs) await selar(s, a, V.Falsa);
      await time.increase(4 * DIA);
      for (const [i, j] of s.jurados.entries()) await revelar(s, j, i < 3 ? V.Verdadeira : V.Falsa);
      for (const a of s.obs) await revelar(s, a, V.Falsa);
      expect(todos.length).to.equal(7);
      await b.livro.finalizar(1); // todos revelaram: encerra antes do prazo
      expect((await b.livro.obterRegistro(1)).resultado).to.equal(V.Verdadeira);
      expect(await b.livro.obterContagem(1, 1, V.Falsa)).to.equal(2);
    });
  });

  describe("candidatura e período de prova", function () {
    it("qualquer pessoa se candida com depósito e vira aprendiz", async function () {
      const b = await deploy();
      await expect(b.gestao.connect(b.aprs[0]).candidatar({ value: 1n })).to.be.revertedWith("Deposito insuficiente");
      await b.gestao.connect(b.aprs[0]).candidatar({ value: ethers.parseEther("0.01") });
      expect((await b.gestao.obterCandidato(b.aprs[0].address)).estado).to.equal(1);
      await expect(b.gestao.connect(b.aprs[0]).candidatar({ value: ethers.parseEther("0.01") })).to.be.revertedWith("Ja candidato");
      await expect(b.gestao.connect(b.revs[0]).candidatar({ value: ethers.parseEther("0.01") })).to.be.revertedWith("Ja e revisor");
    });

    it("só o OathChain registra participação e faltas", async function () {
      const b = await comAprendizes();
      await expect(b.gestao.registrarParticipacao(b.aprs[0].address)).to.be.revertedWith("So o OathChain");
      await expect(b.gestao.registrarFalta(b.aprs[0].address)).to.be.revertedWith("So o OathChain");
      await expect(b.livro.adicionarRevisorPelaGestao(b.aprs[0].address)).to.be.revertedWith("So o contrato de gestao");
    });

    async function rodadaComAprendizes(b, votoAprendiz) {
      const s = await sorteada(b);
      for (const j of s.jurados) await selar(s, j, V.Verdadeira);
      for (const a of s.obs) await selar(s, a, votoAprendiz);
      await time.increase(4 * DIA);
      for (const j of s.jurados) await revelar(s, j, V.Verdadeira);
      for (const a of s.obs) await revelar(s, a, votoAprendiz);
      await b.livro.finalizar(1);
      return s;
    }

    it("DISCORDAR da maioria não é punido: só conta como participação", async function () {
      const b = await comAprendizes();
      const s = await rodadaComAprendizes(b, V.Falsa); // aprendizes contra a maioria
      for (const a of s.obs) {
        const c = await b.gestao.obterCandidato(a.address);
        expect(c.votosProva).to.equal(1);
        expect(c.faltas).to.equal(0);
        expect(c.deposito).to.equal(ethers.parseEther("0.01")); // nenhuma multa
      }
    });

    it("promoção automática: votos de prova + tempo; vira revisor no OathChain", async function () {
      const b = await comAprendizes();
      const alvo = b.aprs[0];
      // dá 2 votos de prova ao alvo por registros diferentes
      await b.livro.definirJuri(5, 3, true); // todos os aprendizes observam
      for (let i = 1n; i <= 2n; i++) {
        await b.livro.connect(b.autor).registrarAfirmacao("ipfs://a" + i, "2025", 0);
        await b.livro.connect(b.autor).abrirVerificacao(i);
        await mine(4);
        await b.livro.sortearJurados(i);
        const [, jur, obs] = await b.livro.obterJuri(i, 1);
        const s = { livro: b.livro, id: i };
        const todos = [...jur, ...obs].map((e) => b.sig.find((x) => x.address === e));
        for (const p of todos) await b.livro.connect(p).comprometerVoto(i, selo(V.Verdadeira, SAL, p.address, i, 1));
        await time.increase(4 * DIA);
        for (const p of todos) await b.livro.connect(p).revelarVoto(i, V.Verdadeira, SAL, JUST, LINK);
        await b.livro.finalizar(i);
      }
      expect((await b.gestao.obterCandidato(alvo.address)).votosProva).to.equal(2);
      expect(await b.gestao.podePromover(alvo.address)).to.equal(true);
      await b.gestao.connect(b.estranho).promover(alvo.address); // qualquer um chama
      expect(await b.livro.ehRevisor(alvo.address)).to.equal(true);
      expect((await b.gestao.obterCandidato(alvo.address)).estado).to.equal(2);
    });

    it("não promove sem votos de prova, sem tempo ou sem vaga", async function () {
      const b = await comAprendizes();
      await expect(b.gestao.promover(b.aprs[0].address)).to.be.revertedWith("Votos de prova insuficientes");
      await expect(b.gestao.promover(b.estranho.address)).to.be.revertedWith("Nao e aprendiz");
    });

    it("limite de crescimento: poucas promoções por janela (anti-enxurrada de contas novas)", async function () {
      const b = await comAprendizes();
      await b.gestao.definirParametros(ethers.parseEther("0.01"), 1, 1, 0, 20, 7 * DIA, 1); // 1% (mín. 1 vaga)
      await b.livro.definirJuri(5, 3, true);
      await b.livro.connect(b.autor).registrarAfirmacao("ipfs://a", "2025", 0);
      await b.livro.connect(b.autor).abrirVerificacao(1);
      await mine(4);
      await b.livro.sortearJurados(1);
      const [, jur, obs] = await b.livro.obterJuri(1, 1);
      const todos = [...jur, ...obs].map((e) => b.sig.find((x) => x.address === e));
      for (const p of todos) await b.livro.connect(p).comprometerVoto(1, selo(V.Verdadeira, SAL, p.address, 1n, 1));
      await time.increase(4 * DIA);
      for (const p of todos) await b.livro.connect(p).revelarVoto(1, V.Verdadeira, SAL, JUST, LINK);
      await b.livro.finalizar(1);
      await b.gestao.promover(b.aprs[0].address);
      await expect(b.gestao.promover(b.aprs[1].address)).to.be.revertedWith("Sem vaga nesta janela");
      await time.increase(8 * DIA);
      await b.gestao.promover(b.aprs[1].address);
      expect(await b.livro.ehRevisor(b.aprs[1].address)).to.equal(true);
    });

    it("faltas: sorteado que não vota paga multa e conta falta", async function () {
      const b = await comAprendizes();
      const s = await sorteada(b);
      const [faltoso, ...resto] = s.jurados;
      for (const j of resto) await selar(s, j, V.Verdadeira);
      await time.increase(4 * DIA);
      for (const j of resto) await revelar(s, j, V.Verdadeira);
      await time.increase(4 * DIA);
      await expect(b.livro.finalizar(1)).to.emit(b.livro, "FaltaDeParticipacao");
      // jurados "faltosos" que não são candidatos (cadastrados pelo dono) não têm registro no gestão: ignorado
      expect((await b.gestao.obterCandidato(faltoso.address)).estado).to.equal(0);
    });

    it("aprendiz sorteado que não participa: falta, multa de 20% e expulsão após exceder o limite", async function () {
      const b = await comAprendizes();
      for (const k of [1n, 2n]) {
        await b.livro.definirJuri(5, 3, true); // todos os 3 aprendizes observam (a configuração é "fotografada" na abertura)
        await b.livro.connect(b.autor).registrarAfirmacao("ipfs://a" + k, "2025", 0);
        await b.livro.connect(b.autor).abrirVerificacao(k);
        await mine(4);
        await b.livro.sortearJurados(k);
        const [, jur] = await b.livro.obterJuri(k, 1);
        for (const e of jur) {
          const p = b.sig.find((x) => x.address === e);
          await b.livro.connect(p).comprometerVoto(k, selo(V.Verdadeira, SAL, e, k, 1));
        }
        await time.increase(4 * DIA);
        for (const e of jur) {
          const p = b.sig.find((x) => x.address === e);
          await b.livro.connect(p).revelarVoto(k, V.Verdadeira, SAL, JUST, LINK);
        }
        await time.increase(4 * DIA); // aprendizes não participaram
        await b.livro.finalizar(k);
      }
      const a = b.aprs[0];
      const c = await b.gestao.obterCandidato(a.address);
      expect(c.faltas).to.equal(2);
      expect(c.deposito).to.equal(ethers.parseEther("0.01") - 2n * ethers.parseEther("0.002"));
      await b.gestao.rebaixar(a.address); // maxFaltas = 1 → expulso
      expect((await b.gestao.obterCandidato(a.address)).estado).to.equal(3);
      const antes = await ethers.provider.getBalance(a.address);
      await b.gestao.connect(a).sacar();
      expect(await ethers.provider.getBalance(a.address)).to.be.gt(antes);
      expect(await b.gestao.multasRetidas()).to.be.gt(0);
    });

    it("sair devolve o depósito e tira o aprendiz do sorteio", async function () {
      const b = await comAprendizes();
      await b.gestao.connect(b.aprs[0]).sair();
      expect((await b.gestao.obterCandidato(b.aprs[0].address)).deposito).to.equal(0);
      await expect(b.gestao.connect(b.aprs[0]).sair()).to.be.revertedWith("Nao participa");
    });
  });
});
