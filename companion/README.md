# Gesture Cam Companion

O Desktop Control precisa deste companion porque navegadores não podem controlar mouse/teclado do sistema operacional diretamente.

## Windows

1. Instale Python 3.
2. Abra a pasta `companion`.
3. Execute `start_windows.bat`.
4. O servidor abre `http://127.0.0.1:8765/` automaticamente.
5. Entre em **Desktop Control**, clique em **Conectar companion** e depois em **Ativar controle**.

## Segurança

- O servidor escuta apenas em `127.0.0.1`.
- O WebSocket aceita apenas ações pré-definidas.
- Não existe execução arbitrária de terminal ou shell.
- `pyautogui.FAILSAFE` está ligado: mover o mouse para o canto superior esquerdo continua servindo como failsafe do PyAutoGUI.
- Dentro do Gesture Cam, segurar `✋` por aproximadamente 1 segundo desarma o controle e solta os botões do mouse.

## Gestos

- `☝️` move o cursor.
- `🤏` faz clique esquerdo.
- `✌️` faz clique direito.
- `✊` segura o botão esquerdo para arrastar.
- `✋` em movimento vertical faz scroll; segurada por ~1 s desarma o controle.
