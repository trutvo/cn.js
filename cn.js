const DATA_CHANNEL = 'cns::data'

class EventDispatcher {
    constructor() {
        this.topics = new Map()
    }

    call_listeners(listeners, message) {
        for(let l of listeners) {
            l(message)
        }
    }

    to(topic, message) {
        if(this.topics.has(topic)) {
            this.call_listeners(this.topics.get(topic), message)
        }
    }
    on(topic, listener) {
        if(this.topics.has(topic)) {
            this.topics.get(topic).push(listener)
        }
        else {
            this.topics.set(topic, [listener] )
        }
    }
}

function findValue(data, path) {
    function findRecusive(obj, propArray) {
        const [head, ...tail] = propArray;
        const value = obj[head] 
        if(tail.length > 0) {
            return findRecusive(value, tail);
        }
        return value;
    }
    return findRecusive(data, path.split('.'));
}

class DataHandler {
    constructor(path, onUpdate) {
        this.path = path
        this.onUpdate = onUpdate
    }

    set(obj, prop, value) {
        var ref = this.path + prop
        var result = Reflect.set(...arguments)
        this.onUpdate(ref, value)
        return result
    }
}

function utilizeObject(updateCallback, obj, path = "") {
    for (var prop in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, prop)) {
            var value = obj[prop]
            if(typeof value === 'object' && value !== null) {
                var newPath = path + prop + "."
                obj[prop] = utilizeObject(updateCallback, value, newPath)
            }
        }
    }
    return new Proxy(obj, new DataHandler(path, updateCallback));
}

class TextNodeTemplate {
    constructor(data, textNode, template, pathList) {
        this.textNode = textNode
        this.template = template
        this.pathList = pathList
        this.data = data
    }

    update() {
        var text = this.template
        for(var path of this.pathList) {
            var value = findValue(this.data, path)
            text = text.replaceAll(new RegExp(`{{\\s*${path}\\s*}}`, 'g'), value)
        }
        this.textNode.textContent = text
    }
}

class App {

    constructor(rootSelector, data) {
        this.topics = new Map()
        this.eventDispatcher = new EventDispatcher()
        this.templates = []
        this.rootSelector = rootSelector

        const onDataUpdate = (p, v) => this.to(DATA_CHANNEL, { type: 'UPDATE', name: p, value: v })
        this.data = utilizeObject(onDataUpdate, data)
      
        this.#initEvents()

        this.#createTemplates()

        this.refresh()
        this.on(DATA_CHANNEL, (m) => { this.refresh() })
    }

    #createTemplates() {
        const root = document.querySelector(`${this.rootSelector}`)
        const iter = document.createNodeIterator(root, NodeFilter.SHOW_TEXT)
        var textNode
        while (textNode = iter.nextNode()) {
            const text = textNode.textContent
            const pathList = [...text.matchAll(/{{\s*([\w\.]+)\s*}}/g)].map( m => m[1])
            if(pathList.length > 0) {
                const template = new TextNodeTemplate(this.data, textNode, text, pathList)
                this.templates.push(template)
            }
        }
    }

    #initEvents() {
        const click_elements = document.querySelectorAll(`${this.rootSelector} *[cn\\:click]`)
        for (var element of click_elements) {
            const action = element.getAttribute('cn:click')
            element.addEventListener("click", () => { this.#eval(action) })
            element.removeAttribute('cn:click')
        }
    }

    #eval(code) {
        const app = this
        function to(topic, message) {
            app.to(topic, message)
        }
        const data = this.data
        eval(code)
    }

    refresh() {
        for(var t of this.templates) {
            t.update()
        }
    }

    to(topic, message) {
        this.eventDispatcher.to(topic, message)
        return this
    }

    on(topic, listener) {
        this.eventDispatcher.on(topic, listener)
        return this
    }
}

export function mount(rootSelector, data) {
    return new App(rootSelector, data);
}