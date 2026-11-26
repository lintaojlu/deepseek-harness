/** Whiteboard labels. Product copy lives in these dictionaries. */

/** Namespace owned by the whiteboard plugin. */
export const NS = 'whiteboard'

/** Simplified Chinese labels and the key set. */
export const zh = {
  'tab.title': '画板',
  'tab.description': '在一张 Excalidraw 画布上绘图，保存到这台电脑，或连同提示发送到某个会话。',
  'save': '保存',
  'open': '打开',
  'send': '发送到会话',
  'theme': '主题',
  'theme.light': '浅色',
  'theme.dark': '深色',
  'dialog.title': '发送画板',
  'dialog.description': '该会话会收到这张图和你的提示，并从这条消息继续。',
  'dialog.session': '会话',
  'dialog.choose': '选择会话',
  'dialog.prompt': '提示',
  'dialog.placeholder': '希望代理根据这张图做什么？',
  'dialog.cancel': '取消',
  'dialog.submit': '发送',
  'dialog.sending': '正在发送',
  'status.saved': '已开始下载。',
  'status.sent': '已发送。该会话会按你的提示继续。',
  'status.sendFailed': '画板没能发送。请再试一次。',
  'status.openFailed': '这个文件不是 Excalidraw 画板。',
  'status.empty': '没有可选的会话。',
  'canvas.failed': '画布无法加载。',
} as const

/** Dictionary keys accepted by this plugin's translator. */
export type WhiteboardKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Whiteboard canvas, theme, and send dialog. */
    whiteboard: WhiteboardKey
  }
}

/** English labels, checked against the Chinese key set. */
export const en: Record<WhiteboardKey, string> = {
  'tab.title': 'Whiteboard',
  'tab.description': 'Draw on one Excalidraw canvas, save it on this computer, or send it to a session with a prompt.',
  'save': 'Save',
  'open': 'Open',
  'send': 'Send to session',
  'theme': 'Theme',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'dialog.title': 'Send drawing',
  'dialog.description': 'The session receives this drawing as an image with your prompt and continues from that message.',
  'dialog.session': 'Session',
  'dialog.choose': 'Choose a session',
  'dialog.prompt': 'Prompt',
  'dialog.placeholder': 'What should the agent do with this drawing?',
  'dialog.cancel': 'Cancel',
  'dialog.submit': 'Send',
  'dialog.sending': 'Sending',
  'status.saved': 'Download started.',
  'status.sent': 'Sent. The session continues with your prompt.',
  'status.sendFailed': 'The drawing could not be sent. Try again.',
  'status.openFailed': 'That file is not an Excalidraw drawing.',
  'status.empty': 'No session is available.',
  'canvas.failed': 'The canvas could not be loaded.',
}

/** Japanese labels. */
export const ja: Record<WhiteboardKey, string> = {
  'tab.title': 'ホワイトボード',
  'tab.description': '1 枚の Excalidraw キャンバスに描き、このコンピュータに保存するか、プロンプトと一緒にセッションへ送ります。',
  'save': '保存',
  'open': '開く',
  'send': 'セッションに送る',
  'theme': 'テーマ',
  'theme.light': 'ライト',
  'theme.dark': 'ダーク',
  'dialog.title': '描画を送る',
  'dialog.description': 'セッションはこの画像とプロンプトを受け取り、そのメッセージから続行します。',
  'dialog.session': 'セッション',
  'dialog.choose': 'セッションを選択',
  'dialog.prompt': 'プロンプト',
  'dialog.placeholder': 'この描画でエージェントに何をさせますか？',
  'dialog.cancel': 'キャンセル',
  'dialog.submit': '送信',
  'dialog.sending': '送信中',
  'status.saved': 'ダウンロードを開始しました。',
  'status.sent': '送信しました。セッションはプロンプトに沿って続行します。',
  'status.sendFailed': '描画を送信できませんでした。もう一度試してください。',
  'status.openFailed': 'このファイルは Excalidraw の描画ではありません。',
  'status.empty': '選べるセッションがありません。',
  'canvas.failed': 'キャンバスを読み込めませんでした。',
}

/** Spanish labels. */
export const es: Record<WhiteboardKey, string> = {
  'tab.title': 'Pizarra',
  'tab.description': 'Dibuja en un lienzo de Excalidraw, guárdalo en este equipo o envíalo a una sesión con una instrucción.',
  'save': 'Guardar',
  'open': 'Abrir',
  'send': 'Enviar a la sesión',
  'theme': 'Tema',
  'theme.light': 'Claro',
  'theme.dark': 'Oscuro',
  'dialog.title': 'Enviar dibujo',
  'dialog.description': 'La sesión recibe este dibujo como imagen junto con tu instrucción y continúa desde ese mensaje.',
  'dialog.session': 'Sesión',
  'dialog.choose': 'Elige una sesión',
  'dialog.prompt': 'Instrucción',
  'dialog.placeholder': '¿Qué debe hacer el agente con este dibujo?',
  'dialog.cancel': 'Cancelar',
  'dialog.submit': 'Enviar',
  'dialog.sending': 'Enviando',
  'status.saved': 'La descarga ha empezado.',
  'status.sent': 'Enviado. La sesión continúa con tu instrucción.',
  'status.sendFailed': 'No se pudo enviar el dibujo. Inténtalo de nuevo.',
  'status.openFailed': 'Ese archivo no es un dibujo de Excalidraw.',
  'status.empty': 'No hay ninguna sesión disponible.',
  'canvas.failed': 'No se pudo cargar el lienzo.',
}

/** French labels. */
export const fr: Record<WhiteboardKey, string> = {
  'tab.title': 'Tableau',
  'tab.description': 'Dessinez sur un canevas Excalidraw, enregistrez-le sur cet ordinateur, ou envoyez-le à une session avec une invite.',
  'save': 'Enregistrer',
  'open': 'Ouvrir',
  'send': 'Envoyer à la session',
  'theme': 'Thème',
  'theme.light': 'Clair',
  'theme.dark': 'Sombre',
  'dialog.title': 'Envoyer le dessin',
  'dialog.description': 'La session reçoit ce dessin en image avec votre invite et poursuit à partir de ce message.',
  'dialog.session': 'Session',
  'dialog.choose': 'Choisir une session',
  'dialog.prompt': 'Invite',
  'dialog.placeholder': 'Que doit faire l’agent avec ce dessin ?',
  'dialog.cancel': 'Annuler',
  'dialog.submit': 'Envoyer',
  'dialog.sending': 'Envoi',
  'status.saved': 'Le téléchargement a commencé.',
  'status.sent': 'Envoyé. La session continue avec votre invite.',
  'status.sendFailed': 'Le dessin n’a pas pu être envoyé. Réessayez.',
  'status.openFailed': 'Ce fichier n’est pas un dessin Excalidraw.',
  'status.empty': 'Aucune session n’est disponible.',
  'canvas.failed': 'Le canevas n’a pas pu être chargé.',
}

/** German labels. */
export const de: Record<WhiteboardKey, string> = {
  'tab.title': 'Zeichenfläche',
  'tab.description': 'Zeichnen Sie auf einer Excalidraw-Fläche, speichern Sie sie auf diesem Computer oder senden Sie sie mit einem Prompt an eine Sitzung.',
  'save': 'Speichern',
  'open': 'Öffnen',
  'send': 'An Sitzung senden',
  'theme': 'Thema',
  'theme.light': 'Hell',
  'theme.dark': 'Dunkel',
  'dialog.title': 'Zeichnung senden',
  'dialog.description': 'Die Sitzung erhält diese Zeichnung als Bild zusammen mit Ihrem Prompt und setzt bei dieser Nachricht fort.',
  'dialog.session': 'Sitzung',
  'dialog.choose': 'Sitzung auswählen',
  'dialog.prompt': 'Prompt',
  'dialog.placeholder': 'Was soll der Agent mit dieser Zeichnung tun?',
  'dialog.cancel': 'Abbrechen',
  'dialog.submit': 'Senden',
  'dialog.sending': 'Wird gesendet',
  'status.saved': 'Der Download hat begonnen.',
  'status.sent': 'Gesendet. Die Sitzung setzt mit Ihrem Prompt fort.',
  'status.sendFailed': 'Die Zeichnung konnte nicht gesendet werden. Versuchen Sie es erneut.',
  'status.openFailed': 'Diese Datei ist keine Excalidraw-Zeichnung.',
  'status.empty': 'Keine Sitzung ist verfügbar.',
  'canvas.failed': 'Die Fläche konnte nicht geladen werden.',
}

/** Russian labels. */
export const ru: Record<WhiteboardKey, string> = {
  'tab.title': 'Доска',
  'tab.description': 'Рисуйте на одном холсте Excalidraw, сохраните его на этом компьютере или отправьте в сессию вместе с запросом.',
  'save': 'Сохранить',
  'open': 'Открыть',
  'send': 'Отправить в сессию',
  'theme': 'Тема',
  'theme.light': 'Светлая',
  'theme.dark': 'Тёмная',
  'dialog.title': 'Отправить рисунок',
  'dialog.description': 'Сессия получит этот рисунок как изображение вместе с запросом и продолжит с этого сообщения.',
  'dialog.session': 'Сессия',
  'dialog.choose': 'Выберите сессию',
  'dialog.prompt': 'Запрос',
  'dialog.placeholder': 'Что агент должен сделать с этим рисунком?',
  'dialog.cancel': 'Отмена',
  'dialog.submit': 'Отправить',
  'dialog.sending': 'Отправка',
  'status.saved': 'Загрузка началась.',
  'status.sent': 'Отправлено. Сессия продолжит по вашему запросу.',
  'status.sendFailed': 'Не удалось отправить рисунок. Попробуйте ещё раз.',
  'status.openFailed': 'Этот файл не является рисунком Excalidraw.',
  'status.empty': 'Нет доступной сессии.',
  'canvas.failed': 'Не удалось загрузить холст.',
}

/** Portuguese labels. */
export const pt: Record<WhiteboardKey, string> = {
  'tab.title': 'Quadro',
  'tab.description': 'Desenhe num canvas Excalidraw, guarde-o neste computador ou envie-o para uma sessão com um pedido.',
  'save': 'Guardar',
  'open': 'Abrir',
  'send': 'Enviar para a sessão',
  'theme': 'Tema',
  'theme.light': 'Claro',
  'theme.dark': 'Escuro',
  'dialog.title': 'Enviar desenho',
  'dialog.description': 'A sessão recebe este desenho como imagem juntamente com o seu pedido e continua a partir dessa mensagem.',
  'dialog.session': 'Sessão',
  'dialog.choose': 'Escolher uma sessão',
  'dialog.prompt': 'Pedido',
  'dialog.placeholder': 'O que deve o agente fazer com este desenho?',
  'dialog.cancel': 'Cancelar',
  'dialog.submit': 'Enviar',
  'dialog.sending': 'A enviar',
  'status.saved': 'A transferência começou.',
  'status.sent': 'Enviado. A sessão continua com o seu pedido.',
  'status.sendFailed': 'Não foi possível enviar o desenho. Tente novamente.',
  'status.openFailed': 'Esse ficheiro não é um desenho Excalidraw.',
  'status.empty': 'Nenhuma sessão está disponível.',
  'canvas.failed': 'Não foi possível carregar o canvas.',
}
