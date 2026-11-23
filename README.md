# Portal - Vídeo em LIBRAS

Plugin WordPress para associar um vídeo em LIBRAS a qualquer tipo de conteúdo público e exibi-lo em um player flutuante no front-end.

## Instalação

Copie esta pasta para `wp-content/plugins/portal-plugin-video-libras` e ative o plugin no painel do WordPress.

O painel do Editor de Blocos e os assets do front-end já estão incluídos. Para recompilar o painel após alterar `assets/src/editor.js`, instale as dependências de desenvolvimento e execute:

```sh
npm install
npm run build
```

## Uso

No Editor de Blocos, informe a URL no painel **Vídeo em LIBRAS** da barra lateral. No Editor Clássico, use a caixa **Vídeo em LIBRAS**. URLs HTTP/HTTPS de YouTube, Vimeo e arquivos diretos (`.mp4`, `.webm`, `.ogv` e `.m4v`) são aceitas. Deixe o campo vazio para remover o vídeo.

O player aparece automaticamente nas páginas singulares que tenham uma URL válida. A janela usa proporção 16:9 para vídeos incorporados e adapta-se às dimensões dos vídeos diretos quando seus metadados estão disponíveis. Em telas pequenas, a janela pode ser rolada para exibir vídeos verticais.
