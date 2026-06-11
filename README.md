# Leads Automation

Ferramenta de automacao para geracao de leads a partir do Google Maps.

## Requisitos

- [Bun](https://bun.sh/) v1.0+
- Playwright browsers instalados

## Instalacao

```bash
# Instalar dependencias
bun install

# Instalar browsers do Playwright
bunx playwright install chromium
```

## Configuracao

Copie o arquivo de exemplo e configure conforme necessario:

```bash
cp .env.example .env
```

Variaveis disponiveis:

| Variavel | Descricao | Padrao |
|----------|-----------|--------|
| `PORT` | Porta do servidor | `3000` |
| `HOST` | Host do servidor | `localhost` |
| `MAX_CONCURRENT_REQUESTS` | Requisicoes simultaneas | `3` |
| `REQUEST_TIMEOUT` | Timeout em ms | `30000` |
| `HEADLESS` | Executar browser sem interface | `true` |
| `DETAIL_CONCURRENCY` | Paginas de detalhes do Maps processadas em paralelo | `3` |
| `WEBSITE_CONCURRENCY` | Sites de negocios raspados em paralelo | `4` |
| `BLOCK_RESOURCES` | Bloquear imagens/fontes/midia para acelerar | `true` |
| `URL_OVERFETCH_RATIO` | Coleta extra de URLs para compensar falhas | `1.4` |

## Uso

### Iniciar o servidor

```bash
# Modo producao
bun run start

# Modo desenvolvimento (com hot reload)
bun run dev
```

O servidor estara disponivel em `http://localhost:3000`

### Interface Web

Acesse `http://localhost:3000` no navegador para usar a interface grafica.

1. Preencha o **Nicho** (ex: "Fisioterapia", "Restaurantes", "Academias")
2. Preencha a **Localizacao** (ex: "Sao Paulo, SP, Brasil")
3. Selecione a **Quantidade** de leads desejada (1-200)
4. (Opcional) Abra **Opcoes Avancadas** para filtrar por avaliacao minima, exigir telefone/site/e-mail ou desativar a extracao de contatos dos sites
5. Clique em **Gerar Leads**

### API

#### Iniciar geracao de leads

```bash
POST /api/leads/generate
Content-Type: application/json

{
  "niche": "Fisioterapia",
  "location": {
    "city": "Apucarana",
    "state": "Parana",
    "country": "Brasil"
  },
  "quantity": 20,
  "options": {
    "extractWebsiteContacts": true,
    "minRating": 4,
    "requirePhone": false,
    "requireWebsite": false,
    "requireEmail": false
  }
}
```

#### Verificar status do job

```bash
GET /api/leads/jobs/:jobId
```

#### Listar todos os jobs

```bash
GET /api/leads/jobs
```

#### Exportar leads para CSV

```bash
GET /api/export/csv/:jobId
```

## Dados Extraidos

Para cada negocio encontrado, a ferramenta extrai:

- **Nome** do estabelecimento
- **Categoria** do negocio (ex: "Restaurante", "Dentista")
- **Telefone** (formatado com +55)
- **WhatsApp** (do Maps, do site ou derivado do telefone)
- **E-mail** (primario + todos os encontrados no site)
- **Website**
- **Endereco**
- **Coordenadas** (latitude/longitude)
- **Redes sociais** (Facebook, Instagram, LinkedIn, Twitter/X)
- **Avaliacao** (estrelas)
- **Numero de avaliacoes**

## Estrutura do Projeto

```
leads-automation/
├── public/           # Frontend (HTML/CSS/JS)
├── src/
│   ├── config/       # Configuracoes
│   ├── extractors/   # Extratores de dados
│   ├── scrapers/     # Scrapers (Google Maps)
│   ├── server/       # Servidor Hono
│   │   └── routes/   # Rotas da API
│   ├── services/     # Servicos de negocio
│   ├── types/        # Tipos TypeScript
│   └── utils/        # Utilitarios
├── .env.example
├── package.json
└── tsconfig.json
```

## Tecnologias

- **Runtime**: [Bun](https://bun.sh/)
- **Web Framework**: [Hono](https://hono.dev/)
- **Web Scraping**: [Playwright](https://playwright.dev/)
- **Validacao**: [Zod](https://zod.dev/)

## Licenca

MIT
