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
Permanecem como backlog nao bloqueante a revisao de textos local/demo no frontend, alinhamento textual do assunto/corpo do e-mail com o remetente institucional, timezone explicito no template de expiracao, observabilidade dedicada para SMTP, rate limit distribuido antes de escala horizontal e reavaliacao do readiness de banco diante de cold start/wake-up do Neon Free.

Status:
Ativa.
