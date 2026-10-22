const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const quietConsole = { log() {}, warn() {}, error() {} };

function classList(...initial) {
    const values = new Set(initial);
    return {
        add: (...names) => names.forEach((name) => values.add(name)),
        remove: (...names) => names.forEach((name) => values.delete(name)),
        contains: (name) => values.has(name),
        toggle(name, force) {
            const enabled = force === undefined ? !values.has(name) : Boolean(force);
            if (enabled) {
                values.add(name);
            } else {
                values.delete(name);
            }
            return enabled;
        },
    };
}

function element(ownerDocument, id = "") {
    const listeners = new Map();
    const attributes = new Map();
    const styleValues = new Map();
    const node = {
        id,
        alt: "",
        children: [],
        classList: classList(),
        className: "",
        currentTime: 0,
        dataset: {},
        disabled: false,
        hidden: false,
        inert: false,
        innerHTML: "",
        offsetParent: {},
        offsetWidth: 100,
        scrollIntoView() {},
        src: "",
        tabIndex: 0,
        textContent: "",
        value: "",
        style: {
            backgroundImage: "",
            display: "",
            opacity: "",
            setProperty: (name, value) => styleValues.set(name, value),
            removeProperty: (name) => styleValues.delete(name),
            getPropertyValue: (name) => styleValues.get(name) || "",
        },
        addEventListener(type, handler) {
            const handlers = listeners.get(type) || [];
            handlers.push(handler);
            listeners.set(type, handlers);
        },
        removeEventListener(type, handler) {
            listeners.set(type, (listeners.get(type) || []).filter((item) => item !== handler));
        },
        dispatch(type, event = {}) {
            const payload = { currentTarget: node, target: node, ...event };
            (listeners.get(type) || []).slice().forEach((handler) => handler(payload));
        },
        appendChild(child) {
            child.parentNode = node;
            node.children.push(child);
            return child;
        },
        append(...children) {
            children.forEach((child) => node.appendChild(child));
        },
        replaceChildren(...children) {
            node.children = children;
            children.forEach((child) => { child.parentNode = node; });
        },
        setAttribute(name, value) {
            attributes.set(name, String(value));
        },
        getAttribute(name) {
            return attributes.get(name) ?? null;
        },
        removeAttribute(name) {
            attributes.delete(name);
        },
        focus() {
            ownerDocument.activeElement = node;
        },
        getAnimations: () => [],
        animate: () => ({ cancel() {} }),
        querySelector: () => null,
        querySelectorAll: () => [],
        closest: () => null,
        pause() {},
        play: () => Promise.resolve(),
        remove() {
            if (node.parentNode) {
                node.parentNode.children = node.parentNode.children.filter((child) => child !== node);
            }
        },
    };
    return node;
}

function documentStub() {
    const nodes = new Map();
    const listeners = new Map();
    const document = {
        activeElement: null,
        visibilityState: "visible",
        body: null,
        getElementById(id) {
            if (!nodes.has(id)) {
                nodes.set(id, element(document, id));
            }
            return nodes.get(id);
        },
        createElement: (tagName) => element(document, tagName),
        createElementNS: (namespace, tagName) => element(document, tagName),
        querySelector: () => null,
        querySelectorAll: () => [],
        contains: () => true,
        addEventListener(type, handler) {
            const handlers = listeners.get(type) || [];
            handlers.push(handler);
            listeners.set(type, handlers);
        },
        removeEventListener(type, handler) {
            listeners.set(type, (listeners.get(type) || []).filter((item) => item !== handler));
        },
        dispatch(type, event = {}) {
            (listeners.get(type) || []).slice().forEach((handler) => handler(event));
        },
    };
    document.body = element(document, "body");
    return document;
}

function storageStub(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: (key) => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: (key) => values.delete(key),
    };
}

function runClassicScript(relativePath, globals = {}) {
    const context = vm.createContext({
        console,
        clearInterval,
        clearTimeout,
        setInterval,
        setTimeout,
        ...globals,
    });
    const source = fs.readFileSync(path.join(root, relativePath), "utf8");
    vm.runInContext(source, context, { filename: relativePath });
    return context;
}

function lexical(context, expression) {
    return vm.runInContext(expression, context);
}

module.exports = {
    root,
    quietConsole,
    classList,
    element,
    documentStub,
    storageStub,
    runClassicScript,
    lexical,
};
