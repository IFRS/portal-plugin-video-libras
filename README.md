# Portal - Vídeo em LIBRAS

Plugin WordPress para associar um vídeo em LIBRAS a qualquer tipo de conteúdo público e exibi-lo em um player flutuante no front-end.

## Instalação

Para instalar pelo painel do WordPress, envie `build/portal-plugin-video-libras.zip` em **Plugins > Adicionar novo > Enviar plugin**.

Para usar o repositório diretamente em `wp-content/plugins/portal-plugin-video-libras` ou alterar os assets, gere os arquivos compilados antes de ativar o plugin:

```sh
npm install
npm run build
```

Durante o desenvolvimento, use `npm run start` para recompilar os assets ao salvar alterações. O build inclui o Editor de Blocos, os scripts e estilos do front-end e da tela de configurações; os arquivos gerados em `assets/build/` e `build/` não são versionados.

## Uso

Em **Configurações > Vídeo em LIBRAS**, personalize a posição, distância das bordas, cor, largura inicial, rótulo, tipos de conteúdo e supressão do VLibras. A pré-visualização acompanha as alterações antes de salvar. A paleta do tema ativo pode ser usada junto ao seletor de cor; o texto e o ícone recebem uma cor de contraste automático. Em algumas cores intermediárias, usa-se preto puro para garantir contraste WCAG AA.

Em Multisite, as configurações padrão ficam em **Administração da rede > Configurações > Vídeo em LIBRAS**. Cada site pode herdá-las ou manter suas próprias configurações. A pré-visualização da tela do site mostra as opções locais, mesmo quando a herança está marcada; nesse caso, as opções da rede são as utilizadas no site.

No Editor de Blocos, informe a URL no painel **Vídeo em LIBRAS** da barra lateral. No Editor Clássico, use a caixa **Vídeo em LIBRAS**. URLs HTTP/HTTPS de YouTube, Vimeo e arquivos diretos (`.mp4`, `.webm`, `.ogv` e `.m4v`) são aceitas. Deixe o campo vazio para remover o vídeo.

O player aparece automaticamente nas páginas singulares que tenham uma URL válida. A janela usa proporção 16:9 para vídeos incorporados e adapta-se às dimensões dos vídeos diretos quando seus metadados estão disponíveis. Em telas pequenas, a janela pode ser rolada para exibir vídeos verticais.

Por padrão, nessas páginas, o widget VLibras é ocultado para priorizar o vídeo em LIBRAS. O plugin desativa os hooks e assets conhecidos do plugin oficial e também oculta widgets inseridos pelo tema ou por ferramentas como o Google Tag Manager. Essa integração pode ser desativada nas configurações. Nas páginas sem URL válida, o VLibras permanece inalterado. Para inserções tardias, a neutralização por JavaScript é observada por até 10 segundos; a ocultação por CSS continua ativa após esse período.

Arraste o cabeçalho para mover a janela ou use as setas com o cabeçalho em foco. Para redimensioná-la, arraste a alça no canto superior esquerdo ou use as setas esquerda e direita com a alça em foco. A posição e a largura são mantidas durante a sessão na mesma aba e prevalecem sobre as configurações iniciais até a sessão terminar.
