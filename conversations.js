const localforage = require("localforage")
const { CONVERSATION_SELECTED_EVENT, CONVERSATION_TITLE_EVENT } = require("./config")

class Conversations {
    #conversationsGroup
    #conversations = []

    constructor() {
        this.#initializeConversations()
    }

    #initializeConversations() {
        this.#conversationsGroup = document.querySelector(".list-group")

        localforage.getItem("conversations").then((value) => {
            this.#conversations = JSON.parse(value) || []
            this.#renderConversations()
        })

        document.querySelector("#new-conversation")
                .addEventListener("click", this.#onNewConversation)

        nw.Window.get().window.addEventListener(CONVERSATION_TITLE_EVENT, (event) => {
            const { conversationId, title } = event.detail
            
            const conversation = this.#conversations.find(conversation => conversation.id == conversationId)
            if (conversation) {
                conversation.title = title
                this.#syncConversations() 
            }

        })
    }

    #syncConversations() {
        this.#saveConversations()
        this.#renderConversations()
    }

    #makeConversationsHTML() {
        const maxTitleLength = 60

        const result = 
            this.#conversations.map(conversation => {
                const destroyButton = "<button class='btn btn-danger invisible delete-conversation'>删除</button>"
                let title = conversation.title

                if (title.length > maxTitleLength) {
                    title = title.substring(0, maxTitleLength) + "..."
                }

                return `<a href="#" data-conversation-id="${conversation.id}" class="list-group-item d-flex justify-content-between"><div class="flex-shrink-1">${title}</div>${destroyButton}</a>`
            }).join("")
        
        return result
    }

    #renderConversations() {
        this.#conversationsGroup.innerHTML = this.#makeConversationsHTML()
        this.#bindConversationEvents()
    }

    #onNewConversation = ()=> {
        const id = this.#newId()
        this.#conversations.push({ id: id, title: `#${id}`})

        this.#syncConversations() 
    }

    #newId() {
        return this.#conversations.length + 1
    }

    #bindConversationEvents() {
        this.#conversationsGroup.querySelectorAll("a").forEach(item => {
            item.addEventListener("click", (event) => {
                const conversationId = event.currentTarget.dataset.conversationId
                const conversationWindow = nw.Window.get()

                nw.Window.open("messages.html", {}, (win) => {
                    win.on("loaded", () => {
                        const event = new CustomEvent(
                            CONVERSATION_SELECTED_EVENT, 
                            { detail: { conversationId, conversationWindow } }
                        )

                        win.window.dispatchEvent(event)
                    })
                    
                    win.maximize()
                })
            })
        })

        this.#conversationsGroup.querySelectorAll(".delete-conversation").forEach(item => {
            item.addEventListener("click", (event) => {
                event.preventDefault()
                event.stopImmediatePropagation()

                const conversationId = event.target.parentElement.dataset.conversationId
                if (confirm("确认要删除该对话吗?")) {
                    const index = this.#conversations.findIndex(conversation => conversation.id == conversationId)

                    if (index != -1) {
                        this.#conversations.splice(index, 1)

                        this.#clearMessagesStore(conversationId)
                        this.#syncConversations() 
                    }
                }
            })
        })
    }

    #saveConversations() {
        localforage.setItem("conversations", JSON.stringify(this.#conversations))
    }

    #clearMessagesStore(conversationId) {
        localforage.removeItem(`conversation:${conversationId}:messages`)
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new Conversations()
})