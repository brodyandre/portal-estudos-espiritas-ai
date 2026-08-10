# Plano Mestre

## Estado

Producao operacional.

Baseline atual: `9738fdc3e62e975b3ea15e19dde721b52996f754`.

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

## Entrega Atual

9C.11 -- SMTP e Recuperacao de Senha em Producao.

### 9C.11.1 -- Hardening local de testes/env SMTP

Reforcar testes e validacoes locais relacionadas a SMTP de producao, sem configurar provedor real e sem alterar ambiente externo.

### 9C.11.2 -- Documentacao operacional do provider SMTP

Documentar variaveis, placeholders, seguranca, operacao esperada e limites do provedor SMTP real escolhido.

### 9C.11.3 -- Configuracao controlada de secrets no Render

Configurar secrets SMTP reais somente mediante autorizacao explicita. Esta etapa nao deve ser acoplada a commit de codigo.

### 9C.11.4 -- Validacao minima autorizada com envio real

Executar teste operacional minimo de recuperacao de senha em producao somente com autorizacao explicita e conta/endereco previamente definidos.

### 9C.11.5 -- Relatorio pos-validacao e observabilidade

Registrar resultado, limites remanescentes e necessidade futura de observabilidade dedicada ou rate limit distribuido.

## Depois da 9C.11

Backlog futuro a definir. Nao ha decisao consolidada neste documento para novas funcionalidades alem da operacionalizacao segura de SMTP e recuperacao de senha em producao.
