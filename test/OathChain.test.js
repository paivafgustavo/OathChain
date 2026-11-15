const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

// Veredito: 0 Nenhum, 1 Verdadeira, 2 Falsa, 3 Inconclusiva, 4 Cumprida, 5 Parcial, 6 NaoCumprida
const V = { Nenhum: 0, Verdadeira: 1, Falsa: 2, Inconclusiva: 3, Cumprida: 4, Parcial: 5, NaoCumprida: 6 };
// Estado: 0 Registrada, 1 EmVerificacao, 2 Finalizada, 3 SemConsenso
const E = { Registrada: 0, EmVerificacao: 1, Finalizada: 2, SemConsenso: 3 };
const SETE_DIAS = 7 * 24 * 3600;

describe("OathChain", function () {
  async function deploy() {
    const [dono, autor, r1, r2, r3, estranho] = await ethers.getSigners();
    const livro = await ethers.deployContract("OathChain");
    for (const r of [r1, r2, r3]) await livro.definirRevisor(r.address, true);
    const criterios = ethers.keccak256(ethers.toUtf8Bytes("10 escolas inauguradas"));
    return { livro, dono, autor, r1, r2, r3, estranho, criterios };
  }

  // Afirmação já em verificação (id 1)
  async function comAfirmacao() {
    const b = await deploy();
    await b.livro.connect(b.autor).registrarAfirmacao("ipfs://a", "2025", 0);
    await b.livro.connect(b.autor).abrirVerificacao(1);
    return { ...b, id: 1n };
  }

  // Promessa registrada (id 1), ainda dentro do prazo
  async function comPromessa() {
    const b = await deploy();
    const prazo = (await time.latest()) + 1000;
    await b.livro.connect(b.autor).registrarPromessa("ipfs://promessa", b.criterios, prazo);
    return { ...b, prazo, id: 1n };
  }

  // Promessa finalizada como Cumprida (r1 e r2 votaram)
  async function promessaFinalizada() {
    const b = await comPromessa();
    await time.increaseTo(b.prazo);
    await b.livro.abrirVerificacao(b.id);
    await b.livro.connect(b.r1).votar(b.id, V.Cumprida, "ipfs://j1");
    await b.livro.connect(b.r2).votar(b.id, V.Cumprida, "ipfs://j2");
    await b.livro.finalizar(b.id);
    return b;
  }

  describe("registro", () => {
    it("afirmação nasce 'Registrada' e só o autor abre a verificação", async () => {
      const { livro, autor, estranho } = await loadFixture(deploy);
      await livro.connect(autor).registrarAfirmacao("ipfs://a", "2025", 0);
      expect((await livro.obterRegistro(1)).estado).to.equal(E.Registrada);
      await expect(livro.connect(estranho).abrirVerificacao(1)).to.be.revertedWith("So o autor abre afirmacao");
      await expect(livro.connect(autor).abrirVerificacao(1)).to.emit(livro, "VerificacaoAberta");
    });

    it("rejeita promessa com prazo no passado ou sem critérios", async () => {
      const { livro, criterios } = await loadFixture(deploy);
      const passado = (await time.latest()) - 10;
      await expect(livro.registrarPromessa("ipfs://x", criterios, passado)).to.be.revertedWith("Prazo deve estar no futuro");
      const futuro = (await time.latest()) + 100;
      await expect(livro.registrarPromessa("ipfs://x", ethers.ZeroHash, futuro)).to.be.revertedWith("Criterios obrigatorios");
    });

    it("rejeita CID vazio", async () => {
      const { livro } = await loadFixture(deploy);
      await expect(livro.registrarAfirmacao("", "2025", 0)).to.be.revertedWith("CID vazio");
    });
  });

  describe("administração", () => {
    it("só o dono mexe em revisores, mínimo e janela", async () => {
      const { livro, estranho } = await loadFixture(deploy);
      await expect(livro.connect(estranho).definirRevisor(estranho.address, true)).to.be.revertedWithCustomError(livro, "OwnableUnauthorizedAccount");
      await expect(livro.connect(estranho).definirMinRevisores(2)).to.be.revertedWithCustomError(livro, "OwnableUnauthorizedAccount");
      await expect(livro.connect(estranho).definirJanelaVotacao(10)).to.be.revertedWithCustomError(livro, "OwnableUnauthorizedAccount");
    });

    it("conta revisores ativos sem duplicar", async () => {
      const { livro, estranho } = await loadFixture(deploy);
      expect(await livro.revisoresAtivos()).to.equal(3);
      await livro.definirRevisor(estranho.address, true);
      await livro.definirRevisor(estranho.address, true); // repetido: ignora
      expect(await livro.revisoresAtivos()).to.equal(4);
      await livro.definirRevisor(estranho.address, false);
      expect(await livro.revisoresAtivos()).to.equal(3);
    });

    it("não abre verificação com revisores insuficientes", async () => {
      const [, autor] = await ethers.getSigners();
      const livro = await ethers.deployContract("OathChain");
      await livro.connect(autor).registrarAfirmacao("ipfs://a", "2025", 0);
      await expect(livro.connect(autor).abrirVerificacao(1)).to.be.revertedWith("Revisores insuficientes");
    });
  });

  describe("fontes", () => {
    it("antes da verificação qualquer um anexa", async () => {
      const { livro, id, estranho } = await loadFixture(comPromessa);
      const h = ethers.keccak256(ethers.toUtf8Bytes("pagina"));
      await expect(livro.connect(estranho).anexarFonte(id, "ipfs://fonte", h)).to.emit(livro, "FonteAnexada");
      const fontes = await livro.obterFontes(id);
      expect(fontes[0].hashConteudo).to.equal(h);
      expect(fontes[0].rodada).to.equal(1);
    });

    it("durante a verificação só revisor; depois de encerrar, ninguém", async () => {
      const { livro, id, r3, estranho } = await loadFixture(promessaFinalizada);
      // já finalizada: ninguém
      await expect(livro.connect(r3).anexarFonte(id, "ipfs://f", ethers.ZeroHash)).to.be.revertedWith("Registro encerrado");

      const b = await loadFixture(comAfirmacao);
      await expect(b.livro.connect(b.estranho).anexarFonte(b.id, "ipfs://f", ethers.ZeroHash)).to.be.revertedWith("Fonte so por revisor");
      await expect(b.livro.connect(b.r1).anexarFonte(b.id, "ipfs://f", ethers.ZeroHash)).to.emit(b.livro, "FonteAnexada");
    });
  });

  describe("regra da maioria (mais de 50% dos revisores)", () => {
    it("2 de 3 revisores bastam: finaliza sem esperar o terceiro", async () => {
      const { livro, id, r3 } = await loadFixture(promessaFinalizada);
      const r = await livro.obterRegistro(id);
      expect(r.estado).to.equal(E.Finalizada);
      expect(r.resultado).to.equal(V.Cumprida);
      expect(await livro.ehVerificado(id)).to.equal(true);
      await expect(livro.connect(r3).votar(id, V.NaoCumprida, "x")).to.be.revertedWith("Nao esta em verificacao");
    });

    it("1 voto de 3 não é maioria: não finaliza dentro da janela", async () => {
      const { livro, id, r1 } = await loadFixture(comAfirmacao);
      await livro.connect(r1).votar(id, V.Verdadeira, "j");
      await expect(livro.finalizar(id)).to.be.revertedWith("Sem maioria ainda");
    });

    it("1-1-1: todos votaram, sem maioria => SemConsenso, nada gravado como veredito", async () => {
      const { livro, id, r1, r2, r3 } = await loadFixture(comAfirmacao);
      await livro.connect(r1).votar(id, V.Verdadeira, "j");
      await livro.connect(r2).votar(id, V.Falsa, "j");
      await livro.connect(r3).votar(id, V.Inconclusiva, "j");
      await expect(livro.finalizar(id)).to.emit(livro, "SemConsenso").withArgs(id, 1);
      const r = await livro.obterRegistro(id);
      expect(r.estado).to.equal(E.SemConsenso);
      expect(r.resultado).to.equal(V.Nenhum);
      expect(await livro.ehVerificado(id)).to.equal(false);
    });

    it("janela acabou sem maioria => SemConsenso", async () => {
      const { livro, id, r1 } = await loadFixture(comAfirmacao);
      await livro.connect(r1).votar(id, V.Verdadeira, "j");
      await time.increase(SETE_DIAS + 1);
      await livro.finalizar(id);
      expect((await livro.obterRegistro(id)).estado).to.equal(E.SemConsenso);
    });

    it("SemConsenso é definitivo: não dá para contestar", async () => {
      const { livro, id, autor, r1 } = await loadFixture(comAfirmacao);
      await time.increase(SETE_DIAS + 1);
      await livro.finalizar(id);
      await expect(livro.connect(autor).contestar(id, "m")).to.be.revertedWith("So se pode contestar apos finalizar");
    });

    it("não se vota depois que a janela fecha", async () => {
      const { livro, id, r1 } = await loadFixture(comAfirmacao);
      await time.increase(SETE_DIAS + 1);
      await expect(livro.connect(r1).votar(id, V.Verdadeira, "j")).to.be.revertedWith("Janela de votacao encerrada");
    });

    it("com 4 revisores, 2 votos NÃO são maioria (precisa de 3)", async () => {
      const b = await loadFixture(deploy);
      const [, , , , , , quarto] = await ethers.getSigners();
      await b.livro.definirRevisor(quarto.address, true);
      await b.livro.connect(b.autor).registrarAfirmacao("ipfs://a", "2025", 0);
      await b.livro.connect(b.autor).abrirVerificacao(1);
      await b.livro.connect(b.r1).votar(1, V.Falsa, "j");
      await b.livro.connect(b.r2).votar(1, V.Falsa, "j");
      await expect(b.livro.finalizar(1)).to.be.revertedWith("Sem maioria ainda");
      await b.livro.connect(b.r3).votar(1, V.Falsa, "j");
      await b.livro.finalizar(1);
      expect((await b.livro.obterRegistro(1)).resultado).to.equal(V.Falsa);
    });
  });

  describe("regras de quem pode votar", () => {
    it("não-revisor não vota; veredito deve combinar com o tipo; sem voto duplicado", async () => {
      const { livro, id, estranho, r1 } = await loadFixture(comAfirmacao);
      await expect(livro.connect(estranho).votar(id, V.Verdadeira, "j")).to.be.revertedWith("Apenas revisores");
      await expect(livro.connect(r1).votar(id, V.Cumprida, "j")).to.be.revertedWith("Veredito invalido para o tipo");
      await livro.connect(r1).votar(id, V.Verdadeira, "j");
      await expect(livro.connect(r1).votar(id, V.Falsa, "j")).to.be.revertedWith("Ja votou nesta rodada");
    });

    it("autor, mesmo sendo revisor, não vota no próprio registro", async () => {
      const b = await loadFixture(deploy);
      await b.livro.definirRevisor(b.autor.address, true);
      await b.livro.connect(b.autor).registrarAfirmacao("ipfs://a", "2025", 0);
      await b.livro.connect(b.autor).abrirVerificacao(1);
      await expect(b.livro.connect(b.autor).votar(1, V.Verdadeira, "j")).to.be.revertedWith("Autor nao pode votar");
    });

    it("revisor que entra DEPOIS da abertura não vota naquela rodada", async () => {
      const { livro, id, estranho } = await loadFixture(comAfirmacao);
      await livro.definirRevisor(estranho.address, true);
      await expect(livro.connect(estranho).votar(id, V.Verdadeira, "j")).to.be.revertedWith("Apenas revisores");
    });

    it("revisor removido não vota mais", async () => {
      const { livro, id, r1 } = await loadFixture(comAfirmacao);
      await livro.definirRevisor(r1.address, false);
      await expect(livro.connect(r1).votar(id, V.Verdadeira, "j")).to.be.revertedWith("Apenas revisores");
    });

    it("promessa: não abre antes do prazo nem se vota antes de abrir", async () => {
      const { livro, id, r1 } = await loadFixture(comPromessa);
      await expect(livro.abrirVerificacao(id)).to.be.revertedWith("Prazo ainda nao venceu");
      await expect(livro.connect(r1).votar(id, V.Cumprida, "j")).to.be.revertedWith("Nao esta em verificacao");
    });

    it("registro inexistente", async () => {
      const { livro, r1 } = await loadFixture(deploy);
      await expect(livro.connect(r1).votar(99, V.Verdadeira, "x")).to.be.revertedWith("Registro inexistente");
    });
  });

  describe("contestação", () => {
    it("autor contesta UMA vez; a segunda é bloqueada", async () => {
      const { livro, id, autor, r1, r2 } = await loadFixture(promessaFinalizada);
      await expect(livro.connect(autor).contestar(id, "ipfs://m"))
        .to.emit(livro, "Contestado").withArgs(id, autor.address, 2, "ipfs://m");

      await livro.connect(r1).votar(id, V.NaoCumprida, "j");
      await livro.connect(r2).votar(id, V.NaoCumprida, "j");
      await livro.finalizar(id);
      expect((await livro.obterRegistro(id)).resultado).to.equal(V.NaoCumprida);

      await expect(livro.connect(autor).contestar(id, "ipfs://m2")).to.be.revertedWith("Autor ja contestou uma vez");
    });

    it("limite de 3 rodadas por registro, para qualquer pessoa", async () => {
      const { livro, id, autor, r1, r2, r3 } = await loadFixture(promessaFinalizada);
      expect(await livro.MAX_RODADAS()).to.equal(3);

      // rodada 2 (contestação do autor)
      await livro.connect(autor).contestar(id, "m");
      await livro.connect(r1).votar(id, V.NaoCumprida, "j");
      await livro.connect(r2).votar(id, V.NaoCumprida, "j");
      await livro.finalizar(id);

      // rodada 3 (contestação de um revisor)
      await livro.connect(r3).contestar(id, "m");
      await livro.connect(r1).votar(id, V.Parcial, "j");
      await livro.connect(r2).votar(id, V.Parcial, "j");
      await livro.finalizar(id);
      expect((await livro.obterRegistro(id)).rodada).to.equal(3);

      // não existe rodada 4
      await expect(livro.connect(r3).contestar(id, "m")).to.be.revertedWith("Limite de rodadas atingido");
      await expect(livro.connect(autor).contestar(id, "m")).to.be.revertedWith("Limite de rodadas atingido");
    });

    it("preserva o histórico da rodada 1 e zera a rodada 2", async () => {
      const { livro, id, autor, r1, r3 } = await loadFixture(promessaFinalizada);
      await livro.connect(autor).contestar(id, "ipfs://m");
      expect(await livro.obterVoto(id, 1, r1.address)).to.equal(V.Cumprida);
      expect(await livro.obterContagem(id, 1, V.Cumprida)).to.equal(2);
      expect(await livro.obterVoto(id, 2, r1.address)).to.equal(V.Nenhum);
      await livro.connect(r3).votar(id, V.Parcial, "j");
      expect(await livro.obterContagem(id, 2, V.Parcial)).to.equal(1);
    });

    it("contestação reabre com nova janela e nova 'foto' de revisores", async () => {
      const { livro, id, autor, estranho } = await loadFixture(promessaFinalizada);
      await livro.definirRevisor(estranho.address, true);
      await livro.connect(autor).contestar(id, "ipfs://m");
      const r = await livro.obterRegistro(id);
      expect(r.totalRevisores).to.equal(4);
      expect(r.estado).to.equal(E.EmVerificacao);
      // o revisor novo já entrou antes desta rodada abrir: pode votar
      await livro.connect(estranho).votar(id, V.Parcial, "j");
    });

    it("revisor também pode contestar; estranho não; e só após finalizar", async () => {
      const { livro, id, estranho, r3 } = await loadFixture(promessaFinalizada);
      await expect(livro.connect(estranho).contestar(id, "m")).to.be.revertedWith("Sem permissao");
      await expect(livro.connect(r3).contestar(id, "m")).to.emit(livro, "Contestado");

      const b = await loadFixture(comAfirmacao);
      await expect(b.livro.connect(b.autor).contestar(b.id, "m")).to.be.revertedWith("So se pode contestar apos finalizar");
    });
  });

  // ---------------------------------------------------------------
  // v3: janela de contestação e veredito definitivo
  // ---------------------------------------------------------------
  describe("janela de contestação e veredito definitivo", () => {
    it("começa em 7 dias e só o dono altera", async () => {
      const { livro, estranho } = await loadFixture(deploy);
      expect(await livro.janelaContestacao()).to.equal(SETE_DIAS);
      await expect(livro.connect(estranho).definirJanelaContestacao(60)).to.be.revertedWithCustomError(livro, "OwnableUnauthorizedAccount");
      await expect(livro.definirJanelaContestacao(0)).to.be.revertedWith("Janela invalida");
    });

    it("registra quando o veredito foi gravado e até quando se pode contestar", async () => {
      const { livro, id } = await loadFixture(promessaFinalizada);
      const r = await livro.obterRegistro(id);
      expect(r.finalizadoEm).to.be.gt(0);
      expect(r.fimContestacao).to.equal(r.finalizadoEm + BigInt(SETE_DIAS));
      expect(await livro.ehDefinitivo(id)).to.equal(false);
    });

    it("depois da janela: não contesta mais e o veredito vira definitivo", async () => {
      const { livro, id, autor, r1 } = await loadFixture(promessaFinalizada);
      await time.increase(SETE_DIAS + 1);
      expect(await livro.ehDefinitivo(id)).to.equal(true);
      await expect(livro.connect(autor).contestar(id, "m")).to.be.revertedWith("Janela de contestacao encerrada");
      await expect(livro.connect(r1).contestar(id, "m")).to.be.revertedWith("Janela de contestacao encerrada");
    });

    it("a janela é 'fotografada' na finalização: mudar depois não afeta vereditos antigos", async () => {
      const { livro, id, autor } = await loadFixture(promessaFinalizada);
      await livro.definirJanelaContestacao(10); // 10 s, só para novos vereditos
      await time.increase(100);
      await expect(livro.connect(autor).contestar(id, "m")).to.emit(livro, "Contestado");
    });

    it("janela curta definida pelo dono vale para o próximo veredito", async () => {
      const b = await loadFixture(deploy);
      await b.livro.definirJanelaContestacao(60);
      await b.livro.connect(b.autor).registrarAfirmacao("ipfs://a", "2025", 0);
      await b.livro.connect(b.autor).abrirVerificacao(1);
      await b.livro.connect(b.r1).votar(1, V.Verdadeira, "j");
      await b.livro.connect(b.r2).votar(1, V.Verdadeira, "j");
      await b.livro.finalizar(1);
      await time.increase(61);
      expect(await b.livro.ehDefinitivo(1)).to.equal(true);
      await expect(b.livro.connect(b.autor).contestar(1, "m")).to.be.revertedWith("Janela de contestacao encerrada");
    });

    it("limite de rodadas também torna o veredito definitivo", async () => {
      const { livro, id, autor, r1, r2, r3 } = await loadFixture(promessaFinalizada);
      await livro.connect(autor).contestar(id, "m");
      await livro.connect(r1).votar(id, V.NaoCumprida, "j");
      await livro.connect(r2).votar(id, V.NaoCumprida, "j");
      await livro.finalizar(id);
      await livro.connect(r3).contestar(id, "m");
      await livro.connect(r1).votar(id, V.Parcial, "j");
      await livro.connect(r2).votar(id, V.Parcial, "j");
      await livro.finalizar(id);
      expect(await livro.ehDefinitivo(id)).to.equal(true);
    });

    it("contestar reabre: deixa de ser definitivo e zera as datas", async () => {
      const { livro, id, autor } = await loadFixture(promessaFinalizada);
      await livro.connect(autor).contestar(id, "m");
      const r = await livro.obterRegistro(id);
      expect(r.finalizadoEm).to.equal(0);
      expect(r.fimContestacao).to.equal(0);
      expect(await livro.ehDefinitivo(id)).to.equal(false);
    });
  });

  // ---------------------------------------------------------------
  // v3: período de referência e registro que substitui outro
  // ---------------------------------------------------------------
  describe("período de referência e substituição", () => {
    // Finaliza uma afirmação com 2 votos iguais. Devolve o id.
    async function finalizarAfirmacao(b, id, voto) {
      await b.livro.connect(b.autor).abrirVerificacao(id).catch(() => {});
      await b.livro.connect(b.r1).votar(id, voto, "j");
      await b.livro.connect(b.r2).votar(id, voto, "j");
      await b.livro.finalizar(id);
    }

    // #1 finalizada como Verdadeira (autor), #2 corrige #1 (estranho), ainda registrada
    async function comCorrecao() {
      const b = await deploy();
      await b.livro.connect(b.autor).registrarAfirmacao("juros em 2025: 1,2 tri", "2025", 0);
      await b.livro.connect(b.autor).abrirVerificacao(1);
      await finalizarAfirmacao(b, 1, V.Verdadeira);
      await b.livro.connect(b.estranho).registrarAfirmacao("juros em 2025: 0,9 tri (dado revisado)", "2025", 1);
      await b.livro.connect(b.estranho).abrirVerificacao(2);
      return b;
    }

    it("afirmação exige o período de referência e o guarda", async () => {
      const { livro, autor } = await loadFixture(deploy);
      await expect(livro.connect(autor).registrarAfirmacao("ipfs://a", "", 0)).to.be.revertedWith("Referencia obrigatoria");
      await livro.connect(autor).registrarAfirmacao("ipfs://a", "out/2026", 0);
      expect((await livro.obterRegistro(1)).referencia).to.equal("out/2026");
    });

    it("só substitui afirmação já finalizada", async () => {
      const b = await loadFixture(comAfirmacao); // #1 em verificação
      await expect(b.livro.registrarAfirmacao("x", "2026", 1)).to.be.revertedWith("So se substitui registro finalizado");
      await expect(b.livro.registrarAfirmacao("x", "2026", 99)).to.be.revertedWith("Registro a substituir inexistente");

      const c = await loadFixture(promessaFinalizada); // #1 é promessa
      await expect(c.livro.registrarAfirmacao("x", "2026", 1)).to.be.revertedWith("So afirmacao substitui afirmacao");
    });

    it("correção aprovada (Verdadeira) supera o registro antigo", async () => {
      const b = await loadFixture(comCorrecao);
      await b.livro.connect(b.r1).votar(2, V.Verdadeira, "j");
      await b.livro.connect(b.r2).votar(2, V.Verdadeira, "j");
      await expect(b.livro.finalizar(2)).to.emit(b.livro, "Superada").withArgs(1, 2);

      const antigo = await b.livro.obterRegistro(1);
      const novo = await b.livro.obterRegistro(2);
      expect(antigo.superadaPor).to.equal(2);
      expect(novo.substitui).to.equal(1);
      // o antigo continua legível, com o veredito original
      expect(antigo.resultado).to.equal(V.Verdadeira);
      expect(antigo.referencia).to.equal("2025");
    });

    it("correção rejeitada (Falsa) não supera o antigo", async () => {
      const b = await loadFixture(comCorrecao);
      await b.livro.connect(b.r1).votar(2, V.Falsa, "j");
      await b.livro.connect(b.r2).votar(2, V.Falsa, "j");
      await b.livro.finalizar(2);
      expect((await b.livro.obterRegistro(1)).superadaPor).to.equal(0);
    });

    it("correção sem consenso não supera o antigo", async () => {
      const b = await loadFixture(comCorrecao);
      await b.livro.connect(b.r1).votar(2, V.Verdadeira, "j");
      await b.livro.connect(b.r2).votar(2, V.Falsa, "j");
      await b.livro.connect(b.r3).votar(2, V.Inconclusiva, "j");
      await b.livro.finalizar(2);
      expect((await b.livro.obterRegistro(2)).estado).to.equal(E.SemConsenso);
      expect((await b.livro.obterRegistro(1)).superadaPor).to.equal(0);
    });

    it("se a correção for derrubada em uma contestação, a superação é desfeita", async () => {
      const b = await loadFixture(comCorrecao);
      await b.livro.connect(b.r1).votar(2, V.Verdadeira, "j");
      await b.livro.connect(b.r2).votar(2, V.Verdadeira, "j");
      await b.livro.finalizar(2);
      expect((await b.livro.obterRegistro(1)).superadaPor).to.equal(2);

      await b.livro.connect(b.estranho).contestar(2, "m"); // autor da correção contesta
      await b.livro.connect(b.r1).votar(2, V.Falsa, "j");
      await b.livro.connect(b.r2).votar(2, V.Falsa, "j");
      await expect(b.livro.finalizar(2)).to.emit(b.livro, "SuperacaoRevertida").withArgs(1, 2);
      expect((await b.livro.obterRegistro(1)).superadaPor).to.equal(0);
    });

    it("a primeira correção aprovada vale; uma segunda não sobrescreve", async () => {
      const b = await loadFixture(comCorrecao);
      // segunda correção do mesmo registro #1
      await b.livro.connect(b.estranho).registrarAfirmacao("outra correção", "2025", 1);
      await b.livro.connect(b.estranho).abrirVerificacao(3);
      for (const id of [2, 3]) {
        await b.livro.connect(b.r1).votar(id, V.Verdadeira, "j");
        await b.livro.connect(b.r2).votar(id, V.Verdadeira, "j");
        await b.livro.finalizar(id);
      }
      expect((await b.livro.obterRegistro(1)).superadaPor).to.equal(2);
    });
  });

  describe("lista de revisores", () => {
    it("lista os revisores sem repetir e guarda desde quando entraram", async () => {
      const { livro, r1, r2, r3, estranho } = await loadFixture(deploy);
      let lista = await livro.obterRevisores();
      expect(lista).to.deep.equal([r1.address, r2.address, r3.address]);
      expect(await livro.revisorDesde(r1.address)).to.be.gt(0);

      await livro.definirRevisor(estranho.address, true);
      await livro.definirRevisor(estranho.address, false);
      await livro.definirRevisor(estranho.address, true); // volta: não duplica
      lista = await livro.obterRevisores();
      expect(lista.length).to.equal(4);
      expect(await livro.ehRevisor(estranho.address)).to.equal(true);
    });
  });
});
