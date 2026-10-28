# Operação do dashboard

## Migrar o menu e as mensagens

Configure `DATABASE_URL` para a base de dados PostgreSQL de produção e execute a migração antes de publicar a nova versão:

```sh
flask --app app:create_app migrate-features
```

O comando cria tabelas em falta e acrescenta colunas às tabelas existentes, sem apagar linhas. Importa as categorias e os pratos de `data/menu.json` que ainda não existam, usando o slug da categoria e o nome do prato para evitar duplicados. Pode ser executado novamente com segurança. Para uma instalação nova, o comando `init-db` mantém-se disponível.

O deploy deve executar esta migração como tarefa de release, antes de encaminhar tráfego para a nova versão. Não execute a migração apontando para uma base de dados que não seja a pretendida.

## Fotografias

Em desenvolvimento, as imagens são guardadas em `assets/uploads/menu/`. Em hospedagem com sistema de ficheiros efémero, como Vercel, configure um bucket S3 ou compatível antes de carregar fotografias:

- `S3_BUCKET`
- `S3_REGION` ou `S3_PUBLIC_BASE_URL`
- `S3_ENDPOINT_URL` para serviços compatíveis, quando aplicável
- `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY`, ou credenciais fornecidas pela plataforma
- `S3_PUBLIC_BASE_URL` quando o bucket usar um domínio público/CDN

As credenciais devem ser definidas como variáveis secretas no serviço de hospedagem, nunca neste ficheiro nem no repositório. As imagens aceites são JPEG, PNG, GIF e WebP, até 8 MB. O URL devolvido pelo armazenamento é guardado em `menu_items.image_url`.

## Segurança

Configure `SECRET_KEY` estável e aleatória no ambiente de produção, `DATABASE_URL` para PostgreSQL e `COOKIE_SECURE=1` quando o site for servido por HTTPS. As rotas `/api/admin/*` requerem sessão administrativa; as alterações exigem também o token CSRF da sessão.