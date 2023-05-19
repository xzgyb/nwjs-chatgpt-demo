class OpenAIClient {
    constructor(accessToken) {
        this.accessToken = accessToken
    }

    chatCompletions(messages, finishedCallback, errorCallback) {
        const parameters = {
            model: "gpt-3.5-turbo",
            messages: messages,
        }

        this.postJson("chat/completions", parameters, finishedCallback, errorCallback)
    }

    postJson(path, parameters, finishedCallback, errorCallback) {
        const url = `https://api.openai.com/v1/${path}`

        fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.accessToken}`,
            },
            body: JSON.stringify(parameters)
        }).then(response => {
            return response.json()
        }).then((jsonResult) => {
            const error = jsonResult["error"]

            if (error) {
                errorCallback(error["message"])
            } else {
                finishedCallback(jsonResult["choices"][0]["message"]["content"])
            }
        }).catch(err => {
            errorCallback(`postJson call error: ${err}`)
        })
    }
}

module.exports = OpenAIClient