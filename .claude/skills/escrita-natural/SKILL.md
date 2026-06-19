---
name: escrita-natural
description: Use ao escrever ou editar qualquer artigo, blurb, meta description ou copy em português para o site do JP Severo (aulas de inglês). Garante uma voz humana de professor e elimina os vícios de texto gerado por IA (antítese "não é X, é Y", travessões dramáticos, palavras-revelação como "o segredo/o truque/a chave", frases-soco e aberturas de hype).
---

# Escrita natural — voz do JP

Os artigos do site existem para soar como um professor de verdade conversando com um aluno,
não como copy de marketing gerada por IA. Quando escrever ou revisar qualquer texto em
português do site (artigos em `artigos/`, blurbs em `artigos.html`, meta/OG descriptions),
aplique esta voz e elimine os padrões abaixo.

## A voz

- **Primeira pessoa do JP**, professor brasileiro de inglês, falando com um aluno: direto,
  caloroso, sem firula. "Eu vejo isso em aula", "você", "a gente".
- **Concreto e com exemplo.** Toda afirmação puxa um exemplo real (frase em inglês, situação
  de aula, número verdadeiro como "mais de 100 alunos").
- **Preserve o que já é bom:** a estrutura dos artigos (H4, `example-block`, `checklist`), as
  frases-exemplo em inglês, os links e as palavras-chave de SEO. Mexa só na *moldura* em
  português, não no conteúdo didático.

## Padrões proibidos (não faça → faça)

Cada um vem com o *porquê*: são marcas de texto de IA que entregam que ninguém escreveu aquilo
de verdade.

| Vício (IA) | Por que evitar | Em vez disso |
|---|---|---|
| Antítese **"Não é sobre X, é sobre Y"** / "não é X — é Y" | Fórmula batida de IA; soa publicitário e vazio | Afirme o ponto direto. "A regularidade vale mais que a intensidade." |
| **Travessão dramático** no meio da frase ("…não é intensidade — é regularidade") | Pausa teatral artificial; ninguém pontua assim numa explicação | Ponto final ou vírgula; quebre em duas frases. |
| Substantivos-revelação: **"o segredo", "o truque", "a chave", "a pergunta mágica", "o pulo do gato", "o combo que muda tudo"** | Promete mágica; soa a thread de LinkedIn | Nomeie a coisa de verdade: "a regra é", "o que resolve é", "o hábito que funciona é". |
| **Frases-soco** soltas para drama: "Simples assim.", "É isso.", "Mentira.", "Ponto final." | Encheção de efeito; quebra o ritmo de professor | Dilua dentro de uma frase normal. |
| **Aberturas de hype**: "Existe um mito…", "A verdade é que…", "Vamos ser honestos", "Spoiler:", "Imagine…", "Resultado?" | Lengalenga antes do conteúdo | Comece pela afirmação concreta do parágrafo. |
| **Regra de três forçada** (lista de três quando só dois itens são reais) | Padrão rítmico de IA | Use o número de itens que existem de verdade. |
| **Negrito dramático** em frase inteira para dar ênfase | Grito visual, não argumento | Reserve `<strong>` para o termo técnico/palavra-chave, não para suspense. |

## Travessões: a regra prática

- **Em prosa** (texto corrido que o leitor lê): **zero travessões.** Reescreva como frase
  natural.
- **Glossa exemplo → tradução** (`I lived in London. — Fechou.` / `find out — descobrir`):
  troque o travessão por **dois-pontos** (`I lived in London: fechou.`), ou reescreva como
  frase ("find out significa descobrir, não 'achar fora'"). Em listas de vocabulário, prefira
  a frase, que já mata a antítese junto.
- **Não toque** em travessões que não são prosa: comentários HTML, `aria-label`,
  `og:image:alt`, nomes em JSON-LD. Não são texto do leitor.

## Encorajado

- "Você" em segunda pessoa, tom de conversa.
- Números e fatos reais ("mais de 100 alunos", "10 minutos por dia").
- Passos imperativos e práticos ("Decore 8 frases", "Grave-se e ouça").
- Variar o tamanho das frases de forma natural — nem tudo curto e batido, nem tudo longo.

## Checklist antes de fechar um texto

1. `grep "—"` no que você escreveu: sobrou travessão em prosa? Reescreva.
2. Tem "não é … é …" como antítese? Afirme direto.
3. Tem "segredo / truque / chave / mágica / combo"? Nomeie a coisa real.
4. Tem frase-soco ou abertura de hype? Dilua.
5. Leia em voz alta: parece o JP explicando, ou um anúncio? Se for anúncio, refaça.
