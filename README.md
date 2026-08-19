# Compatibilidade Locacional

Protótipo v1 de sistema de gestão de conformidade de uso do solo (Campo Grande/MS). React + Vite + Tailwind CSS.

## Rodar localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

Login de demonstração: usuário `admin`, senha `admin123`.

## Build de produção

```bash
npm run build
npm run preview   # opcional, testa o build localmente antes do deploy
```

O build vai para a pasta `dist/`.

## Deploy na Vercel

**Opção 1 — via Git (recomendado):** suba esta pasta para um repositório no GitHub/GitLab/Bitbucket e importe o repositório em vercel.com → New Project. A Vercel detecta automaticamente que é um projeto Vite (`npm install` + `npm run build`, saída em `dist/`) — não precisa configurar nada manualmente.

**Opção 2 — via CLI:**

```bash
npm install -g vercel
vercel login
vercel        # deploy de preview
vercel --prod # deploy de produção
```

## Observações importantes (protótipo)

- **Não há backend.** Todos os dados (terrenos cadastrados) vivem só na memória do navegador — ao dar refresh na página, tudo volta ao estado inicial (os 4 registros de exemplo). Para persistir dados de verdade, é preciso ligar isso a um banco/API.
- **O login é fake.** Usuário/senha (`admin`/`admin123`) são checados direto no código do front-end, sem autenticação real. Isso é aceitável para demonstração, mas não deve ir para produção com dados reais sem uma camada de autenticação de verdade.
- Os dados de zonas/categorias de uso (`ZONAS`, `CATEGORY_INFO` em `src/App.jsx`) foram transcritos manualmente dos PDFs da Lei Complementar 341/2018 (Anexo 8.1) e da Lei Complementar 74/2005 alterada pela 373/2019 (Anexo V) — ainda não foram conferidos contra uma fonte oficial digital.
