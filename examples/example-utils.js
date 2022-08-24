export class HttpClient {
    constructor(onSuccess, onError = () => {}) {
        this.httpRequest = new XMLHttpRequest();
        this.httpRequest.onreadystatechange = () => {
            if (this.httpRequest.readyState === XMLHttpRequest.DONE) {
                if (this.httpRequest.status === 200) {
                   onSuccess(this.httpRequest.responseText)
                } else {
                   onError(this.httpRequest.status)
                }
            }
        }
    }

    get(url) {
        this.httpRequest.open('GET', url, true)
        this.httpRequest.send()
    }
}

export function loadPageCode(onData) {
    const url = window.location.pathname
    const filename =  url.substring(url.lastIndexOf('/')+1)
    const httpClient = new HttpClient(onData)
    httpClient.get(filename)
}