# Portugues Diario

Site estatico de uma pagina para exibir uma dica global de portugues por dia.

## Como abrir

Abra `index.html` no navegador. Nao ha etapa de build nesta primeira versao.

## Publicacao estatica

O projeto nao precisa de build. Publique a raiz do repositorio contendo `index.html`, `styles.css`, `tips.js` e `script.js`.

Opcoes recomendadas:

- GitHub Pages: publicar a branch principal a partir da pasta raiz. O arquivo `.nojekyll` evita processamento extra do GitHub Pages.
- Netlify: criar um novo site apontando para o repositorio, sem comando de build e com diretorio de publicacao como raiz.
- Vercel: importar o repositorio como projeto estatico, sem framework e sem comando de build.

Depois de publicar, confira se a pagina carrega, se as imagens externas aparecem e se o navegador consegue salvar a chave `portugues-diario-rotation` no `localStorage`.

## Implementacao atual

- `index.html`: estrutura da pagina.
- `styles.css`: visual minimalista, responsivo, com paisagem borrada de fundo.
- `tips.js`: base local de dicas no formato da futura API.
- `script.js`: paisagens aleatorias, chamada ao Supabase, fallback local e renderizacao.

O frontend chama a funcao `get_daily_tip` do Supabase usando a Publishable key. Se a chamada falhar, a pagina usa `tips.js` como fallback local.

```js
const { data, error } = await supabaseClient.rpc("get_daily_tip", {
  target_date: today
});
```

## Rotacao local atual

Enquanto nao ha backend, a pagina simula a regra futura usando `localStorage`.

- Mantem a mesma dica durante o mesmo dia.
- Guarda quais dicas ja foram exibidas no ciclo local do navegador.
- Evita repetir dicas ate todas as dicas locais terem aparecido.
- Quando todas aparecerem, inicia um novo ciclo local.

Para testar do zero no navegador, limpe a chave `portugues-diario-rotation` do `localStorage`.

## Links atuais

O link "Sugerir uma dica" abre `sugerir.html`, que envia sugestoes para `tip_suggestions` com status `pending`. A area ADM nao aparece na interface publica; a URL futura ficara reservada para quem tiver acesso. O apoio ao projeto usa o widget flutuante oficial do Buy me a coffee no desktop e um link compacto no rodape do mobile.

## Area ADM

A pagina reservada fica em `admin-portugues-diario.html` e nao e linkada na interface publica. Ela usa Supabase Auth, valida o usuario em `admin_profiles` e lista sugestoes pendentes para converter em draft ou rejeitar.

## Contrato futuro da API

### `GET /api/daily-tip`

Retorna a dica global do dia.

```json
{
  "id": "uuid",
  "date": "2026-05-18",
  "title": "Mas ou mais?",
  "category": "Palavras parecidas",
  "content": "Use 'mas' para oposicao e 'mais' para quantidade ou intensidade.",
  "example": "Eu queria ir, mas estava chovendo.",
  "example2": "Ela comprou mais livros este mes."
}
```

### Endpoints futuros

- `POST /api/suggestions`: recebe sugestao publica de dica.
- `GET /api/admin/suggestions`: lista sugestoes para revisao.
- `PATCH /api/admin/suggestions/:id`: aprova, rejeita ou adiciona notas de revisao.
- `POST /api/admin/tips`: cria uma dica manualmente.
- `PATCH /api/admin/tips/:id`: edita, ativa, inativa ou transforma em rascunho.
- `GET /api/admin/categories`: lista categorias.
- `POST /api/admin/categories`: cria categoria.
- `PATCH /api/admin/categories/:id`: edita categoria.

## Estrutura sugerida do banco

Banco relacional recomendado: PostgreSQL ou Supabase.

### `tips`

Tabela principal com dicas aprovadas, rascunhos internos e dicas inativas.

| Campo | Tipo sugerido | Observacao |
| --- | --- | --- |
| `id` | UUID | Chave primaria |
| `title` | Text | Obrigatorio |
| `category_id` | UUID | Referencia `tip_categories.id` |
| `content` | Text | Obrigatorio |
| `example` | Text nullable | Primeiro exemplo |
| `example2` | Text nullable | Segundo exemplo |
| `status` | Enum | `active`, `inactive`, `draft` |
| `source` | Enum | `admin`, `user_suggestion` |
| `suggestion_id` | UUID nullable | Referencia opcional a `tip_suggestions.id` |
| `created_at` | Timestamp | Criacao |
| `updated_at` | Timestamp | Ultima edicao |

Somente dicas com `status = active` entram no sorteio diario.

### `tip_categories`

| Campo | Tipo sugerido | Observacao |
| --- | --- | --- |
| `id` | UUID | Chave primaria |
| `name` | Text | Nome exibido |
| `slug` | Text unique | Identificador amigavel |
| `created_at` | Timestamp | Criacao |

### `daily_tips`

Registra qual dica foi exibida em cada dia.

| Campo | Tipo sugerido | Observacao |
| --- | --- | --- |
| `id` | UUID | Chave primaria |
| `display_date` | Date unique | Garante uma dica por data |
| `tip_id` | UUID | Referencia `tips.id` |
| `rotation_cycle_id` | UUID | Referencia `rotation_cycles.id` |
| `created_at` | Timestamp | Criacao do registro |

### `rotation_cycles`

Controla os ciclos globais de exibicao.

| Campo | Tipo sugerido | Observacao |
| --- | --- | --- |
| `id` | UUID | Chave primaria |
| `cycle_number` | Integer unique | Numero sequencial |
| `started_at` | Timestamp | Inicio do ciclo |
| `ended_at` | Timestamp nullable | Nulo enquanto ativo |
| `created_at` | Timestamp | Criacao |

### `tip_suggestions`

Armazena sugestoes enviadas por usuarios.

| Campo | Tipo sugerido | Observacao |
| --- | --- | --- |
| `id` | UUID | Chave primaria |
| `title` | Text | Titulo sugerido |
| `category_id` | UUID nullable | Categoria opcional |
| `content` | Text | Explicacao sugerida |
| `example` | Text nullable | Primeiro exemplo |
| `example2` | Text nullable | Segundo exemplo |
| `suggested_by_name` | Text nullable | Nome opcional |
| `suggested_by_email` | Text nullable | Email opcional |
| `status` | Enum | `pending`, `approved`, `rejected`, `converted` |
| `review_notes` | Text nullable | Observacoes internas |
| `created_at` | Timestamp | Envio |
| `reviewed_at` | Timestamp nullable | Revisao |

Sugestoes entram como `pending` e nunca participam do sorteio sem aprovacao.

### `admin_users`

Controle futuro da area administrativa.

| Campo | Tipo sugerido | Observacao |
| --- | --- | --- |
| `id` | UUID | Chave primaria |
| `name` | Text | Nome do administrador |
| `email` | Text unique | Login |
| `password_hash` | Text | Senha com hash |
| `role` | Enum | `owner`, `editor`, `viewer` |
| `status` | Enum | `active`, `inactive` |
| `created_at` | Timestamp | Criacao |
| `last_login_at` | Timestamp nullable | Ultimo acesso |

## Regra futura de sorteio diario

1. Verificar se ja existe registro em `daily_tips` para a data atual.
2. Se existir, retornar essa dica.
3. Se nao existir, buscar o ciclo ativo em `rotation_cycles`.
4. Buscar dicas `active` que ainda nao aparecem em `daily_tips` dentro desse ciclo.
5. Sortear uma dica aleatoria dessa lista.
6. Se nao houver dicas disponiveis, encerrar o ciclo atual, criar novo ciclo e sortear entre todas as dicas ativas.
7. Criar o registro em `daily_tips`.
8. Retornar a dica no formato da API.
