const DATA_CHANNEL = 'cns::data'

const evalWith = function(context, expr) {
    const f = Function.apply(
        null, Object.keys(context).concat('return (' + expr + ')')
    )
    
    return f(...Object.values(context));
}

function getParentsBetween(rootNode, node, parents=[]) {
    let p = node.parentNode
    if(p != null) {
        parents.push(p)
        if(p != rootNode) {
            getParentsBetween(rootNode, p, parents)
        }
    } 
    return parents
}

function isNestedInFlowNode(rootNode, node) {
    const parents =  getParentsBetween(rootNode, node)
    for(let n of parents) {
        if(n.getAttribute("cn:for")) {
            return true
        }
    }
    return false
}

function range(start, stop) {
    return Array.from({ length: stop - start}, (_, i) => start + i)
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

function cloneNodes(nodeList, deep=true) {
    return Array.from(nodeList).map( n => n.cloneNode(deep) )
}

class DataHandler {
    constructor(path, onUpdate) {
        this.path = path
        this.onUpdate = onUpdate
    }

    set(obj, prop, value) {
        const ref = this.path + prop
        const result = Reflect.set(...arguments)
        this.onUpdate(ref, value)
        return result
    }
}

function utilizeObject(updateCallback, obj, path = "") {
    for (let prop in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, prop)) {
            let value = obj[prop]
            if(typeof value === 'object' && value !== null) {
                let newPath = path + prop + "."
                obj[prop] = utilizeObject(updateCallback, value, newPath)
            }
        }
    }

    return new Proxy(obj, new DataHandler(path, updateCallback));
}

class TextNodeTemplate {
    constructor(app, localScope, textNode, template, pathList) {
        this.app = app
        this.textNode = textNode
        this.template = template
        this.pathList = pathList
        this.localScope = localScope
    }

    update() {
        let text = this.template
        for(let path of this.pathList) {
            text = text.replaceAll(`{{${path}}}`, this.app.eval(path, this.localScope))
        }
        this.textNode.textContent = text
    }
}

class ForTemplate {
    constructor(app, localScope, node, elementNodes, generator, varName="it") {
        this.app = app
        this.node = node
        this.elementNodes = elementNodes
        this.generator = generator
        this.templates = []
        this.localScope = localScope
        this.node.innerHTML = ''
        this.varName = varName
    }
    
    update() {
        this.node.innerHTML = ''
        this.templates = []
        this.app.eval(this.generator, this.localScope).forEach( it => this.#addElement(it) )
        this.app.initEvents(this.node, this.localScope)
        this.templates.forEach( t => t.update() )
    }

    #addElement(it) {
        for(let c of cloneNodes(this.elementNodes)) {
            this.node.appendChild(c)
            const element = {}
            element[this.varName] = it
            const scope =  {...this.localScope, ...element}
            if(c.nodeType == Node.TEXT_NODE) {
                this.templates = this.templates.concat(this.app.createTextTemplates(c, scope))
            } else {
                this.templates = this.templates.concat(this.app.createTemplates(c, scope))
            }
        }
    }
}

class App {
    constructor(rootSelector, data) {
        this.topics = new Map()
        this.eventDispatcher = new EventDispatcher()
        this.rootSelector = rootSelector

        const onDataUpdate = (p, v) => this.to(DATA_CHANNEL, { type: 'UPDATE', name: p, value: v })
        this.data = utilizeObject(onDataUpdate, data)
      
        const rootNode = document.querySelector(`${this.rootSelector}`)
        this.initEvents(rootNode)
        this.templates = this.createTemplates(rootNode)

        this.refresh()
        this.on(DATA_CHANNEL, (m) => { this.refresh() })
    }

    createTemplates(node, localScope={}) {
        let templates = this.#createForTemplates(node, localScope)
        templates = templates.concat(this.#createTextTemplatesFromNode(node, localScope))
        return templates
    }

    #createTextTemplatesFromNode(node, localScope) {
        const iter = document.createNodeIterator(node, NodeFilter.SHOW_TEXT)
        let textNode
        let templates = []
        while (textNode = iter.nextNode()) {
            templates = templates.concat(this.createTextTemplates(textNode, localScope))
        }

        return templates
    }

    createTextTemplates(textNode, localScope) {
        let templates = []
        const text = textNode.textContent
        const pathList = [...text.matchAll(/{{([\w\. \+\-\/\*]+)}}/g)].map( m => m[1])
        if(pathList.length > 0) {
            const template = new TextNodeTemplate(this, localScope, textNode, text, pathList)
            templates.push(template)
        }

        return templates
    }

    #createForTemplates(rootNode, localScope) {
        const for_nodes = rootNode.querySelectorAll(`*[cn\\:for]`)
        const level_one_for_nodes = Array.from(for_nodes).filter(n => !isNestedInFlowNode(rootNode, n))
        const templates = []
        for (let node of level_one_for_nodes) {
            if (node.hasChildNodes()) {
                const generator = node.getAttribute('cn:for')
                let varName = node.getAttribute('cn:for-var')
                if(!varName) {
                    varName = "it"
                }
                const children = cloneNodes(node.childNodes) 
                templates.push(new ForTemplate(this, localScope, node, children, generator, varName))
            }
            node.removeAttribute('cn:for')
            node.removeAttribute('cn:for-var')
        }

        return templates
    }

    initEvents(node, localScope={}) {
        const click_elements = node.querySelectorAll(`*[cn\\:click]`)
        for (let element of click_elements) {
            const action = element.getAttribute('cn:click')
            element.addEventListener("click", () => { this.eval(action) })
            element.removeAttribute('cn:click')
        }
    }

    eval(code, localScope={}) {
        const app = this
        const functions = {
            to: function to(topic, message) {
                app.to(topic, message)
            },
            range: range
        }

        const context = {...this.data, ...functions, ...localScope}
        return evalWith(context, code)
    }

    refresh() {
        for(let t of this.templates) {
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