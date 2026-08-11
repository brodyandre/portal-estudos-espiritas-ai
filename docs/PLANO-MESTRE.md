# Plano Mestre

## Estado

Producao operacional.

Baseline de referência da entrega em curso: `400038c8299ce9cd3db99f424a246774ce83bb32`.

Web:

- `https://portal-educacao-continuada.com.br`

API:

- `https://api.portal-educacao-continuada.com.br`

Estado operacional oficial previamente validado:

- `/health = OK`
- `/ready = ready`
- `database = ok`
- `corpus = ready`
- Groq operacional como provider principal
- fallback LLM preservado
- Resend operacional como provider SMTP transacional inicial
- recuperacao de senha validada em producao por smoke real controlado
- frontend de producao sem credenciais demonstrativas ou copy local nas telas de autenticacao
- e-mails transacionais alinhados a identidade publica Portal de Educação Continuada e timezone America/Sao_Paulo

## Capacidades Concluidas

- Monorepo com API Express/TypeScript e Web React/Vite.
- CI com typecheck, testes, build e verificacao de Pages.
- Publicacao estatica do frontend em modo demonstrativo.
- Artefatos de container para API e Web.
- Autenticacao local com JWT, sessoes persistidas e papeis.
- Administracao de usuarios, status, grupos, convites e encontros.
- Grupos de estudo e encontros autenticados.
- Catalogo editorial persistido para livros e documentos.
- RAG governado por manifesto seguro.
- Corpus governado com identidade editorial/fisica, estado operacional e rebuild administrativo.
- Bootstrap automatico assincrono do corpus no startup da API.
- Agent Answer com precedencia de `groupId` explicito e retrieval filtrado.
- Provider Groq configuravel para producao.
- Fallback LLM seguro.
- Infraestrutura SMTP configuravel com `nodemailer`.
- Mailpit para desenvolvimento local.
- Recuperacao e redefinicao de senha ja implementadas em codigo.
- Hardening production/demo/local do frontend autenticado.
- Identidade publica e timezone institucional nos e-mails transacionais.

## Entrega Atual

9C.12 -- Hardening final de experiencia, identidade transacional e validacao.

### 9C.12.1 -- Frontend production/demo mode hardening

Concluida e integrada pelo PR #47 no commit `cf61c4d8d10b6c513e7db9d5e8bce114179bb685`. Producao real nao exibe credenciais demonstrativas nem copy de backend/local nas telas de autenticacao. GitHub Pages permanece em modo demo seguro e desenvolvimento local continua utilizavel.

Finding separado:

- F-001 -- P2: variable/flaky timeouts in unmodified tests, without evidence of relation to 9C.12.1.

### 9C.12.2 -- Identidade e timezone dos e-mails transacionais

Concluida e integrada pelo PR #48 no commit `400038c8299ce9cd3db99f424a246774ce83bb32`. Password recovery usa o subject `Recuperação de acesso — Portal de Educação Continuada`; account invitation usa `Seu acesso ao Portal de Educação Continuada`; expiracoes usam `America/Sao_Paulo` e copy `horário de Brasília`. TTL, transporte SMTP, Resend, Render, DNS, Neon e banco nao foram alterados.

Finding separado:

- W-001 -- P3: marca antiga permanece somente em fixtures `SMTP_FROM_NAME`, asserts negativos e contextos locais deliberados, sem impacto no runtime/template transacional.

### 9C.12.3 -- Documentacao e validacao final

Em implementacao. Esta etapa corrige documentacao desatualizada apos 9C.12.1 e 9C.12.2, formaliza a distincao entre nome interno/historico do projeto e identidade publica do produto, preserva findings nao bloqueantes e registra validacao local final. Nao altera runtime, testes, `.env.example`, Render, Resend, DNS, Neon, banco, deploy ou SMTP real.

Validacao local executada nesta etapa:

- testes focados Web de autenticacao/configuracao/recovery/routing: 4 arquivos, 27 testes, PASS;
- testes focados API de e-mail transacional: 3 arquivos, 8 testes, PASS;
- fluxos API relacionados a recuperacao, convites, inscricoes e auth: 4 arquivos, 164 testes, PASS;
- suite completa API: 61 arquivos, 708 testes, PASS;
- suite completa Web: 42 arquivos, 460 testes, PASS;
- typecheck Web e API, build oficial e `make pages-check`: PASS.

Achados nao bloqueantes registrados:

- readiness de banco apresentou timeout temporario compativel com cold start/wake-up do Neon Free, sem evidencia causal com SMTP;
- rate limit de password recovery/reset permanece em memoria do processo e deve ser distribuido antes de escala horizontal;
- observabilidade SMTP ainda nao possui dashboard ou metricas dedicadas.

## Depois da 9C.12

A 9C.12 fica pronta para encerramento apos integracao da documentacao/validacao final. Backlog futuro identificado, sem virar entrega aprovada automaticamente:

- reavaliar timeout/retry curto de readiness para Neon Free;
- substituir rate limit em memoria por armazenamento distribuido antes de multiplas replicas;
- adicionar observabilidade dedicada para envio SMTP e taxa de entrega.

Novas entregas dependem de decisao futura.
