# Student Onboarding Review

## Objetivo da validacao

Confirmar o fluxo MVP de entrada de novos alunos com:

- pagina publica para QR Code
- inscricao simples
- revisao pelo professor
- liberacao demonstrativa da area do aluno
- ocultacao do link do Google Meet para visitantes nao aprovados
- funcionamento com backend local e em modo demonstrativo no GitHub Pages

## Rotas implementadas

- `/#/portal`
- `/#/educacao-continuada`
- `/#/inscricao`
- `/#/professor`
- `/#/aluno`
- `/#/divulgacao`

## Endpoints implementados

- `POST /api/enrollments`
- `GET /api/enrollments`
- `GET /api/enrollments/:id`
- `PATCH /api/enrollments/:id/status`

## Testes executados

### Comandos

- `npm run lint`
- `npm run test`
- `npm run build`
- `make build`
- `make test`

### Resultado

- `npm run lint`: aprovado
- `npm run test`: aprovado
- `npm run build`: aprovado
- `make build`: aprovado
- `make test`: aprovado

### Cobertura validada no backend

- `POST /api/enrollments` cria interessado com status `pending`
- `GET /api/enrollments` lista interessados e aceita filtros
- `PATCH /api/enrollments/:id/status` aprova, recusa ou marca para conversar
- validacao rejeita `fullName` vazio
- validacao rejeita e-mail invalido
- endpoints publicos de inscricao nao retornam link do Google Meet

### Cobertura validada no frontend

- `/#/educacao-continuada` renderiza corretamente em modo demonstrativo
- `/#/inscricao` envia cadastro e mostra confirmacao amigavel
- `/#/professor` lista novos interessados
- professor consegue aprovar interessado no fluxo demonstrativo
- `/#/aluno` bloqueia visitante nao aprovado
- `/#/aluno` mostra area completa para status `approved`
- link do Google Meet aparece apenas quando o acesso demonstrativo esta aprovado
- fallback continua funcional sem backend

## Comportamentos validados

- O QR Code pode apontar para a pagina publica sem expor o Meet.
- O visitante preenche apenas dados minimos: nome, e-mail, WhatsApp, grupo de interesse, participacao previa e mensagem curta.
- O professor revisa solicitacoes com filtros por status e grupo.
- A aprovacao atualiza o estado demonstrativo do aluno e libera o painel.
- Visitantes pendentes, recusados ou marcados para conversa nao veem o link da aula.
- Quando a API falha ou `VITE_API_URL` nao existe, o frontend continua operando com mocks locais e aviso de modo demonstrativo.

## Ajustes feitos nesta revisao final

- reforco de testes do backend para garantir que os endpoints de inscricao nao exponham `meetUrl`
- ajuste dos testes de frontend para validar a aprovacao no card correto de "Novos interessados"
- confirmacao do desbloqueio demonstrativo da rota `/#/aluno` apos aprovacao local

## Limitacoes do MVP

- nao existe autenticacao real
- o controle de acesso do aluno e apenas demonstrativo e local
- aprovacoes no frontend sem backend nao representam liberacao real
- os dados mockados usam armazenamento local de sessao apenas para demonstracao
- nao ha trilha de auditoria completa nem controle de perfis por usuario

## Proximos passos para autenticacao real

- criar login real para professor e aluno
- associar cada inscricao aprovada a um usuario autenticado
- emitir sessao segura para liberar a area do aluno
- mover persistencia de memoria/mock para armazenamento confiavel
- registrar revisoes e aprovacoes com identidade real do professor
- separar melhor rotas publicas, rotas do professor e rotas restritas do aluno
