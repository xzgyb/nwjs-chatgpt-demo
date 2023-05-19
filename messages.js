const localforage = require("./localforage")
const OpenAIClient = require("./openai_client")

const {    
    API_KEY,
    USER_MESSAGE,
    ASSISTANT_MESSAGE,
    ASSISTANT_PENDING,
    ASSISTANT_COMPLETED,
    ASSISTANT_FAILED,
    CONVERSATION_SELECTED_EVENT,
    CONVERSATION_TITLE_EVENT
} = require("./config")


// Messages
class Messages {
    #openAIClient = new OpenAIClient(API_KEY)
    #conversationWindow
    #conversationId
    #messages = []

    constructor() {
        this.#initializeQuestionInput()
        this.#initializeMessages()
    }

    #initializeQuestionInput() {
        const questionInput = document.querySelector("#message_content")

        questionInput.addEventListener("keydown", (event) => {
            if (event.keyCode === 13) {
                const question = questionInput.value
                this.#renderUserMessage(this.#newId(), question, true)

                const assistantId = this.#newId()
                this.#renderAssistantMessage(assistantId, "", ASSISTANT_PENDING, true)
                this.#saveMessages()

                this.#setConversationTitle(question)

                this.#openAIClient.chatCompletions(this.#makeChatMessages(),
                    (content) => {
                        const result = content.replace(/^\s+|\s+$/g, '')

                        document.querySelector(`#message-${assistantId}`).innerHTML =
                            this.#makeAssistantMessageHTML(assistantId, result, ASSISTANT_COMPLETED)

                        this.#setAssistantMessageById(assistantId, result, ASSISTANT_COMPLETED)
                    },
                    (error) => {
                        document.querySelector(`#message-${assistantId}`).innerHTML =
                            this.#makeAssistantMessageHTML(assistantId, "", ASSISTANT_FAILED)

                        this.#setAssistantMessageById(assistantId, "", ASSISTANT_FAILED)

                        alert(`回答出错: ${error}`)
                    }
                )

                questionInput.value = ""
                questionInput.focus()
            }
        })
    }

    #initializeMessages() {
        nw.Window.get().window.addEventListener(CONVERSATION_SELECTED_EVENT, (event) => {
            this.#conversationId = event.detail.conversationId
            this.#conversationWindow = event.detail.conversationWindow

            localforage.getItem(this.messagesStoreName).then((value) => {
                this.#messages = JSON.parse(value) || []
                this.#renderMessages()
            })
        })
    }

    #renderMessages() {
        for (const message of this.#messages) {
            if (message.type == USER_MESSAGE) {
                this.#renderUserMessage(message.id, message.content)
            } else if (message.type == ASSISTANT_MESSAGE) {
                this.#renderAssistantMessage(message.id, message.content, message.status)
            }
        }
    }

    #saveMessages() {
        localforage.setItem(this.messagesStoreName, JSON.stringify(this.#messages))
    }

    #setAssistantMessageById(id, content, status) {
        for (const message of this.#messages) {
            if (message.id == id) {
                message.content = content
                message.status = status
            }
        }

        this.#saveMessages()
    }

    #makeChatMessages() {
        let result = []

        this.#messages.forEach((message) => {
            if (message.type == USER_MESSAGE) {
                result.push({ role: "user", content: message.content })
            } else if (message.type == ASSISTANT_MESSAGE && message.status == ASSISTANT_COMPLETED) {
                result.push({ role: "assistant", content: message.content })
            }
        })            

        return result
    }

    get messagesStoreName() {
        return `conversation:${this.#conversationId}:messages`
    }

    #newId() {
        return this.#messages.length + 1
    }

    #setConversationTitle(title) {
        // Only set title with the first question
        if (this.#conversationWindow && this.#conversationId && this.#messages.length <= 2) {
            const event = new CustomEvent(
                CONVERSATION_TITLE_EVENT, 
                { detail: { conversationId: this.#conversationId, title } }
            )

            this.#conversationWindow.window.dispatchEvent(event)
        }
    }

    #renderUserMessage(id, question, appendToMessages = false) {
        this.#appendMessageHTML(this.#makeUserMessageHTML(id, question))

        if (appendToMessages) {
            this.#messages.push({id: id, type: USER_MESSAGE, content: question})
        }
    }

    #renderAssistantMessage(id, answer, status, appendToMessages) {
        this.#appendMessageHTML(this.#makeAssistantMessageHTML(id, answer, status))

        if (appendToMessages) {
            this.#messages.push({id: id, type: ASSISTANT_MESSAGE, content: answer, status: status})
        }
    }

    #appendMessageHTML(messageHTML) {
        document.querySelector("#messages").insertAdjacentHTML("beforeend", messageHTML)
    }

    #makeUserMessageHTML(id, question) {
        return `
        <div id="message-${id}">
          <div class="d-flex justify-content-end gap-2">
            <div class="bg-primary bg-opacity-10 p-3 rounded-2">
              <div>${question}</div>
            </div>
            <div class="avatar">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" class="bi bi-person" viewBox="0 0 16 16">
                <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4Zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10Z"></path>
              </svg>
            </div>
          </div>        
        </div>
        `
    }

    #makeAssistantMessageHTML(id, answer, status) {
        let answerHTML = ""
        switch(status) {
            case ASSISTANT_PENDING:
                answerHTML = `<div class="text-muted">处理中...</div>`
                break
            case ASSISTANT_COMPLETED:
                answerHTML = `<pre style="white-space:pre-wrap;word-wrap:break-word;">${answer}</pre>`
                break 
            case ASSISTANT_FAILED:
                answerHTML = `<div class="text-danger">出错了.</div>`
                break
        }

        return `
        <div id="message-${id}">
            <div class="d-flex gap-2">
              <div class="avatar">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" class="bi bi-robot" viewBox="0 0 16 16">
                <path d="M6 12.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5ZM3 8.062C3 6.76 4.235 5.765 5.53 5.886a26.58 26.58 0 0 0 4.94 0C11.765 5.765 13 6.76 13 8.062v1.157a.933.933 0 0 1-.765.935c-.845.147-2.34.346-4.235.346-1.895 0-3.39-.2-4.235-.346A.933.933 0 0 1 3 9.219V8.062Zm4.542-.827a.25.25 0 0 0-.217.068l-.92.9a24.767 24.767 0 0 1-1.871-.183.25.25 0 0 0-.068.495c.55.076 1.232.149 2.02.193a.25.25 0 0 0 .189-.071l.754-.736.847 1.71a.25.25 0 0 0 .404.062l.932-.97a25.286 25.286 0 0 0 1.922-.188.25.25 0 0 0-.068-.495c-.538.074-1.207.145-1.98.189a.25.25 0 0 0-.166.076l-.754.785-.842-1.7a.25.25 0 0 0-.182-.135Z"></path>
                <path d="M8.5 1.866a1 1 0 1 0-1 0V3h-2A4.5 4.5 0 0 0 1 7.5V8a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1v-.5A4.5 4.5 0 0 0 10.5 3h-2V1.866ZM14 7.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7.5A3.5 3.5 0 0 1 5.5 4h5A3.5 3.5 0 0 1 14 7.5Z"></path>
                </svg>
              </div>
              <div class="bg-secondary bg-opacity-10 p-3 rounded-2">
                ${answerHTML}
              </div>
            </div>
        </div>`
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new Messages()
})