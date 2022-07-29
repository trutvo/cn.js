const DATA_CHANNEL = 'cns::data'

const evalWith = function(context, expr) {
    const f = Function.apply(
        null, Object.keys(context).concat('return (' + expr + ')')
    )
    
    return f(...Object.values(context));
}

function range(start, stop, step=1) {
    return Array.from({ length: (stop - start) / step + 1}, (_, i) => start + (i * step))
}

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

function cloneNodes(nodeList, deep=true) {
    return Array.from(nodeList).map( n => n.cloneNode(deep) )
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
        this.data = data
        this.textNode = textNode
        this.template = template
        this.pathList = pathList
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

class ForTemplate {
    constructor(app, node, elementNodes, generator) {
        this.app = app
        this.node = node
        this.elementNodes = elementNodes
        this.generator = generator
    }
    
    update() {
        this.node.innerHTML = ''
        this.app.eval(this.generator).forEach( it => this.#addElement(it) )
    }

    #addElement(it) {
        cloneNodes(this.elementNodes).forEach( c => this.node.appendChild(c) )
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
        this.#createForTemplates()

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

    #createForTemplates() {
        const for_nodes = document.querySelectorAll(`${this.rootSelector} *[cn\\:for]`)
        const app = this
        for (var node of for_nodes) {
            if (node.hasChildNodes()) {
                const generator = node.getAttribute('cn:for')
                const children = cloneNodes(node.childNodes) 
                this.templates.push(new ForTemplate(app, node, children, generator))
                node.innerHTML = ''
            }
            node.removeAttribute('cn:for')
        }
    }

    #initEvents() {
        const click_elements = document.querySelectorAll(`${this.rootSelector} *[cn\\:click]`)
        for (var element of click_elements) {
            const action = element.getAttribute('cn:click')
            element.addEventListener("click", () => { this.eval(action) })
            element.removeAttribute('cn:click')
        }
    }

    eval(code) {
        const app = this
        const functions = {
            to: function to(topic, message) {
                app.to(topic, message)
            },
            range: range
        }
        const context = {...this.data, ...functions}
        return evalWith(context, code)
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