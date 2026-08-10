# AGENTS.md

## Repositorio Canonico

Trabalhe exclusivamente em:

```text
/home/luizandre/Repositorios/portal-estudos-espiritas-ai
```

Nao use clones, copias ou backups em `/mnt/c/...`.

## Leitura Obrigatoria

Antes de planejar, implementar, auditar, preparar staging, commitar, publicar branch ou abrir PR, leia nesta ordem:

1. `AGENTS.md`
2. `docs/ESTADO_ATUAL_PROJETO.md`
3. `docs/DECISOES.md`
4. `docs/PLANO-MESTRE.md`

## Validacao Git

Antes de qualquer alteracao, confirme:

- `pwd`
- branch atual
- `HEAD`
- `origin/main`
- ahead/behind
- workspace
- staging
- arquivos untracked

Se houver divergencia Git relevante, pare e relate. Nao corrija automaticamente.

## Separacao de Etapas

Mantenha separadas as etapas de:

- planejamento
- implementacao
- auditoria
- staging
- commit
- push
- PR
- merge

Execute somente o escopo explicitamente solicitado no prompt atual.

## Operacoes Sensiveis

Nao execute sem autorizacao explicita:

- migrations
- seed
- bootstrap de dados
- deploy
- alteracoes no Render
- DNS
- SMTP real
- banco de dados

## Diretrizes de Engenharia

- Preserve as decisoes arquiteturais existentes.
- Prefira a menor mudanca segura possivel.
- Evite trabalho fora do escopo solicitado.
- Nao reescreva componentes adequados sem necessidade comprovada.
