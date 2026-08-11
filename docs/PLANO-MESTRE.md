# Plano Mestre

## Estado

Producao operacional.

Baseline atual: `ebeb9143e042ea39e790ccb0e61efdca0a287a31`.

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

Concluida. Testes e validacoes locais de SMTP/password recovery foram reforcados sem configurar provedor real nesta etapa.

### 9C.11.2 -- Documentacao operacional do provider SMTP

Concluida. Resend foi registrado como provider SMTP inicial de producao, preservando SMTP padrao via Nodemailer e a separacao entre codigo e operacao.

### 9C.11.3 -- Configuracao controlada de secrets no Render

Concluida operacionalmente. O dominio `email.portal-educacao-continuada.com.br` foi verificado no Resend na regiao Sao Paulo (`sa-east-1`), DNS oficial foi aplicado, credencial restrita foi criada e `portal-estudos-api` foi configurado no Render com `SMTP_ENABLED=true`. Secrets permanecem fora do repositorio.

### 9C.11.4 -- Validacao minima autorizada com envio real

Concluida. Foi executado um smoke real controlado: Resend registrou `Sent` e `Delivered`, o e-mail foi recebido, o link HTTPS oficial permitiu redefinir a senha, o login com a nova senha funcionou e a area `/aluno` foi acessada.

### 9C.11.5 -- Relatorio pos-validacao e observabilidade

Fechamento documental. Esta etapa consolida o estado operacional validado da 9C.11, sem alterar runtime, Render, Resend, DNS, Neon ou banco.

Achados nao bloqueantes registrados:

- readiness de banco apresentou timeout temporario compativel com cold start/wake-up do Neon Free, sem evidencia causal com SMTP;
- rate limit de password recovery/reset permanece em memoria do processo e deve ser distribuido antes de escala horizontal;
- frontend ainda possui textos local/demo em producao;
- assunto/corpo do e-mail ainda usam Portal de Estudos Espíritas, enquanto o remetente validado e Portal de Educação Continuada;
- expiracao do e-mail usa TTL funcional de 30 minutos, mas sem timezone institucional explicito no template;
- observabilidade SMTP ainda nao possui dashboard ou metricas dedicadas.

## Depois da 9C.11

A 9C.11 fica operacionalmente concluida apos a integracao desta documentacao. Backlog futuro identificado, sem virar entrega aprovada automaticamente:

- corrigir textos local/demo e credenciais demonstrativas em telas de autenticacao antes de exposicao mais ampla;
- alinhar identidade textual do e-mail ao remetente institucional aprovado;
- explicitar timezone de expiracao, preferencialmente alinhado a Sao Paulo;
- reavaliar timeout/retry curto de readiness para Neon Free;
- substituir rate limit em memoria por armazenamento distribuido antes de multiplas replicas;
- adicionar observabilidade dedicada para envio SMTP e taxa de entrega.

Novas entregas dependem de decisao futura.
