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

Pendencias operacionais:
Ainda faltam criar/configurar conta Resend, decidir dominio ou subdominio de envio, escolher remetente, aplicar DNS autorizado, criar credencial, configurar Render Secrets e executar smoke test real autorizado. Esta decisao nao significa que SMTP de producao ja esteja ativo.

Status:
Ativa.
