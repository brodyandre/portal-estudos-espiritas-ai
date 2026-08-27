# Decisoes

## D001 -- Repositorio canonico

Decisao:
O trabalho deve ocorrer somente em `/home/luizandre/Repositorios/portal-estudos-espiritas-ai`.

Racional:
Evita divergencia entre clones, copias locais e backups.

Status:
Ativa.

## D002 -- Monorepo API/Web

Decisao:
Manter API e Web no mesmo monorepo, com workspaces `apps/api` e `apps/web`.

Racional:
O projeto compartilha contratos, scripts de CI e ciclo de entrega.

Status:
Ativa.

## D003 -- Dominios de producao

Decisao:
Usar `https://portal-educacao-continuada.com.br` para Web e `https://api.portal-educacao-continuada.com.br` para API.

Racional:
Separa frontend publico e backend operacional com origens explicitas.

Status:
Ativa.

## D004 -- RAG governado por catalogo editorial

Decisao:
Os fluxos publicos de conhecimento usam manifesto/corpus governado, derivado do catalogo editorial persistido e de arquivos autorizados em `data/knowledge`.

Racional:
Impede exposicao acidental de arquivos fora do catalogo, arquivos nao aprovados ou caminhos invalidos.

Status:
Ativa.

## D005 -- Falha fechada do corpus

Decisao:
Se o corpus governado estiver invalido, indisponivel ou inconsistente, os fluxos publicos falham fechado em vez de usar fallback para varredura livre.

Racional:
Governanca editorial tem prioridade sobre disponibilidade parcial.

Status:
Ativa.

## D006 -- Groq como provider principal de producao

Decisao:
O provider LLM principal de producao e Groq, configurado somente no backend.

Racional:
Permite operacao remota em producao sem expor chaves no frontend.

Status:
Ativa.

## D007 -- Fallback LLM preservado

Decisao:
Falhas do provider LLM devem acionar fallback seguro, sem transformar indisponibilidade do corpus governado em resposta de contingencia.

Racional:
Resposta sem modelo pode ser aceitavel; resposta sem corpus autorizado nao e.

Status:
Ativa.

## D008 -- SMTP por configuracao de ambiente

Decisao:
SMTP deve ser ativado por variaveis de ambiente e permanecer desabilitavel por configuracao.

Racional:
Permite Mailpit local, ambiente sem entrega real e producao com provedor transacional sem alterar codigo.

Status:
Ativa.

## D009 -- Secrets fora do repositorio

Decisao:
Secrets reais, incluindo banco, JWT, SMTP e chaves LLM, nao devem ser commitados nem expostos em variaveis publicas Vite.

Racional:
Reduz risco de vazamento e preserva separacao entre codigo e operacao.

Status:
Ativa.

## D010 -- Mailpit para desenvolvimento local

Decisao:
Usar Mailpit como destino SMTP local de desenvolvimento.

Racional:
Permite validar e-mails transacionais sem envio real.

Status:
Ativa.

## D011 -- Menor mudanca segura

Decisao:
Cada entrega deve preferir a menor mudanca segura compativel com o estado real do repositorio.

Racional:
Reduz regressao, evita reescritas desnecessarias e facilita auditoria.

Status:
Ativa.

## D012 -- Separacao entre codigo e operacao

Decisao:
Implementacao de codigo, migrations, seeds, bootstrap, deploy, Render, DNS, SMTP real, push, PR e merge devem ser etapas separadas quando houver risco operacional.

Racional:
Mantem rastreabilidade e evita mutacoes de producao fora de autorizacao explicita.

Status:
Ativa.

## D013 -- Resend como provider SMTP inicial de producao

Decisao:
Resend sera o provider SMTP transacional inicial de producao. A integracao da aplicacao deve continuar usando SMTP padrao por meio da abstracao Nodemailer ja existente.

Racional:
Aproveita o transporte SMTP ja implementado, evita acoplar o dominio de autenticacao ao SDK ou API proprietaria do provider, nao exige dependencia nova, nao exige alteracao de runtime, preserva a possibilidade de substituir o provider futuramente, suporta dominio proprio e oferece porta STARTTLS alternativa util diante da restricao atual das portas SMTP tradicionais no Render Free.

Estado operacional:
O SMTP de producao foi configurado e validado para o piloto da 9C.11. O dominio de envio aprovado e `email.portal-educacao-continuada.com.br`, criado no Resend na regiao Sao Paulo (`sa-east-1`), com Sending habilitado, Receiving desabilitado e estado verificado. Os registros oficiais de DKIM, Return-Path/SPF e SPF foram aplicados no Registro.br. Nenhuma configuracao DMARC adicional foi adotada como requisito desta entrega.

O remetente institucional aprovado e `Portal de Educação Continuada <no-reply@email.portal-educacao-continuada.com.br>`. Reply-To nao esta implementado e nao e requisito do piloto. Mailbox humana para esse endereco tambem nao e pre-requisito do fluxo transacional atual.

Foi criada credencial restrita no Resend com nome operacional `portal-production-smtp`, permissao `Sending access` e restricao ao dominio aprovado. O valor da credencial, `SMTP_PASSWORD`, tokens e demais secrets permanecem fora do repositorio e nao devem ser impressos ou documentados.

O servico `portal-estudos-api` foi configurado no Render com SMTP ativo via `SMTP_ENABLED=true`, `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=2587`, `SMTP_SECURE=false`, `SMTP_USER=resend`, remetente institucional e `APP_PUBLIC_URL=https://portal-educacao-continuada.com.br`.

Validacao:
Um smoke real controlado de recuperacao de senha foi executado com sucesso: o Resend registrou `Sent` e `Delivered`, o e-mail chegou ao endereco controlado, o link HTTPS oficial permitiu redefinir a senha e o login com a nova senha foi concluido.

Limites e evolucoes:
Permanecem como backlog nao bloqueante a observabilidade dedicada para SMTP, rate limit distribuido antes de escala horizontal e reavaliacao do readiness de banco diante de cold start/wake-up do Neon Free. O hardening production/demo do frontend, o alinhamento textual dos e-mails e o timezone explicito do template foram tratados na 9C.12.

Status:
Ativa.

## D014 -- Identidade publica do produto

Decisao:
Manter a distincao entre o nome interno/historico do projeto e a identidade publica apresentada ao usuario.

Racional:
`Portal de Estudos Espiritas com IA` continua valido para repositorio, packages, namespaces, documentacao historica e referencias tecnicas. `Portal de Educação Continuada` e a identidade publica/transacional atual do produto, usada em experiencia de producao e comunicacoes ao usuario.

Status:
Ativa.

## D015 -- Identidade e timezone dos e-mails transacionais

Decisao:
Os templates transacionais de recuperacao de senha e convite de conta usam a identidade textual `Portal de Educação Continuada`. A expiracao e formatada com `America/Sao_Paulo` e apresentada ao usuario como `horário de Brasília`.

Racional:
Alinha os e-mails ao remetente institucional validado em producao sem acoplar a copy dos templates aos campos operacionais `SMTP_FROM_*`.

Notas:
A 9C.12.2 nao alterou TTL, transporte SMTP, provider Resend, Render, DNS, Neon ou banco. `SMTP_FROM_NAME` e `SMTP_FROM_EMAIL` permanecem configuracoes operacionais separadas.

Status:
Ativa.

## D016 -- Observabilidade SMTP transacional segura

Decisao:
A observabilidade operacional de SMTP transacional deve ocorrer no transporte transacional central, com eventos estruturados e sanitizados para sucesso e falha:

- `transactional_email_send_succeeded`;
- `transactional_email_send_failed`.

Os tipos de mensagem inicialmente suportados sao:

- `password_recovery`;
- `account_invitation`.

Racional:
O transporte central e o ponto unico que conhece o resultado real de `sendMail`, evitando duplicidade entre controller, notifier e mailer. A telemetria operacional deve permanecer separada da auditoria persistente de negocio, que tem semantica e finalidade diferentes.

Privacidade:
Os eventos nao devem registrar destinatario, e-mail, nome do destinatario, token, URL sensivel, querystring, corpo HTML/text, credenciais SMTP, secrets, erro bruto sensivel ou resposta bruta do Nodemailer.

Limites:
Nao introduzir dashboard, webhook, SDK de provider, endpoint, banco de metricas, contador artificial ou infraestrutura nova sem necessidade operacional concreta.

Status:
Ativa.

## D017 -- Bootstrap governado dos grupos produtivos

Decisao:
Os grupos produtivos iniciais `emmanuel` e `a-caminho-da-luz` devem ser inicializados por script explicito `groups:bootstrap`, depois das migrations e da catalogacao `knowledge:catalog`. O script exige `KnowledgeBook` ativo correspondente, nao cria livros, nao usa seed demonstrativo e falha fechado em conflitos.

Racional:
Evita popular producao com dados mockados ou incompletos, preserva a governanca editorial por livro e separa schema, catalogo e dados operacionais.

Status:
Ativa.

## D018 -- Vinculo multi-grupo normalizado para professores

Decisao:
Professores podem possuir vinculo persistente com multiplos grupos por meio de `TeacherStudyGroup`, usando chave composta `userId/groupId`. Alunos mantem o vinculo canonico atual no usuario.

Racional:
Permite administrar e consultar grupos de professores sem duplicar usuario, sem usar campos legados como autoridade multi-grupo. Originalmente esta foi a fundacao estrutural para uma autorizacao pedagogica posterior; apos BOOK-ACCESS-001A/B/C, `TeacherStudyGroup` tambem e a fonte persistida usada pelo backend para calcular o escopo TEACHER autorizado.

Limites:
Essa decisao registra a fundacao estrutural de MULTIGROUP-001. Ela nao libera provisioning de Professor real, nao substitui a authority BookAccess e nao concede acesso por si so fora das regras autenticadas de usuario, grupo ativo e livro editorial ativo.

Status:
Ativa.

## D019 -- BookAccess como autoridade pedagogica privada

Decisao:
O escopo pedagogico privado de aluno e professor deve ser resolvido no backend por BookAccess autenticado. O endpoint `GET /api/me/book-access` e a authority privada para retornar grupos e livros autorizados: aluno deriva do grupo persistido no usuario; professor deriva de `TeacherStudyGroup`; `VISITOR` e `ADMIN` nao recebem acesso pedagogico automatico.

Racional:
Centraliza a autorizacao em dados persistidos e governados, evita que o frontend conceda acesso por query string, localStorage ou titulo de livro, e separa administracao de usuarios de autoridade pedagogica.

Status:
Ativa.

## D020 -- Agent/RAG protegido por BookAccess e bookId editorial

Decisao:
Agent Answer e retrieval RAG autenticados devem usar o escopo BookAccess do usuario e o `bookId` editorial canonico. `groupId`, `bookTitle`, hints de frontend, query string e estado local nao concedem acesso nem trocam o livro autorizado durante uma request. O grupo selecionado e imutavel durante a request; indisponibilidade, conflito ou ausencia de escopo autorizado falham fechado.

Racional:
Preserva a fronteira entre preferencia visual do cliente e autorizacao real, evita cross-group leakage e garante que o filtro editorial use identidade canonica persistida.

Status:
Ativa.

## D021 -- Identidade dinamica de StudyGroup no frontend

Decisao:
`StudyGroupId` no frontend e uma identidade string de runtime para grupos persistidos. `DemoGroupSlug` permanece restrito aos fixtures e dados demonstrativos. A existencia de uma string de grupo nao significa autorizacao: escopo privado vem de BookAccess e navegacao publica vem do catalogo publico de estudos.

Racional:
Permite que novos grupos persistidos sejam exibidos e reconciliados sem allowlist local no frontend, mantendo dados demo estritos e evitando que identidade dinamica seja confundida com permissao.

Status:
Ativa.

## D022 -- Catalogo publico de materiais separado da capability Knowledge

Decisao:
O catalogo publico `/api/studies` define quais grupos sao navegaveis em `/materiais/:groupSlug`. A capability publica de Knowledge pode ser menor e permanece fail-closed para grupos sem suporte em `/api/knowledge`; atualmente os grupos publicos suportados por Knowledge sao `emmanuel` e `a-caminho-da-luz`. Grupos conhecidos sem Knowledge publico devem apresentar estado seguro de preparacao, sem coercao para outro grupo e sem endpoint inventado.

Racional:
Separa descoberta publica de grupos da disponibilidade editorial/publica de materiais Knowledge, permitindo rotas publicas dinamicas sem expor conteudo nao catalogado nem depender de fallback cruzado.

Status:
Ativa.

## D023 -- Cobertura governada do corpus por StudyGroup ativo

Decisao:
A cobertura operacional do corpus governado nao deve comparar o total de documentos catalogados com o total de fontes publicadas no manifesto. O gate correto deriva os alvos de `StudyGroup` ativo vinculado a `KnowledgeBook` ativo, deduplicado por livro, e exige ao menos uma fonte pedagogica utilizavel incluida no manifesto editorial governado para esse `bookId` canonico.

Racional:
O catalogo pode conter documentos `DRAFT`, `NEEDS_REVIEW`, `REVIEWED` ou `ARCHIVED` legitimamente fora do RAG. Somente documento aprovado, livro ativo e arquivo fisico validado dentro de `data/knowledge` podem chegar ao manifesto. Fonte `readme` isolada nao satisfaz cobertura pedagogica, e conteudo `shared` nao cobre automaticamente outro livro sem fonte propria.

Limites:
O gate de cobertura e read-only e nao automatiza aprovacao editorial, transicoes de review, rebuild de corpus, seed, migration, bootstrap ou alteracao de producao. Uma eventual operacao editorial/rebuild posterior pertence a CORPUS-COVERAGE-001B e depende de autorizacao explicita.

Status:
Ativa.
