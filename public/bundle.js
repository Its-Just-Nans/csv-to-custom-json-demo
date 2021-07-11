
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.38.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* eslint require-await: "off"*/
    const parseFile = async function (pathToFile, schema, optionsUser) {
        // Default options
        if (typeof optionsUser === "undefined" || optionsUser === null) {
            optionsUser = {};
        }
        // Obligate to do typeof optionsUser.separator !== "undefined" && optionsUser.separator !== null
        // Because if it's "false" -> optionsUser.nameOptions || true -> will be true
        const checkOptions = (value, defaultValue) => {
            if (typeof value !== "undefined" && value !== null) {
                return value;
            } else {
                return defaultValue;
            }
        };
        const options = {
            arrayParse: checkOptions(optionsUser.arrayParse, true),
            callBackForce: checkOptions(optionsUser.callBackForce, false),
            debug: checkOptions(optionsUser.debug, false),
            error: checkOptions(optionsUser.error, false),
            lineCallBack: checkOptions(optionsUser.lineCallBack, null),
            parse: checkOptions(optionsUser.parse, true),
            separator: checkOptions(optionsUser.separator, ","),
            privateSeparator: checkOptions(optionsUser.privateSeparator, "..."),
            overrideFirstLine: checkOptions(optionsUser.overrideFirstLine, false),
            avoidVoidLine: checkOptions(optionsUser.avoidVoidLine, false),
        };
        if (options.debug) {
            if (typeof schema !== "undefined" && schema !== null) {
                console.log("HAS SCHEMA");
            } else {
                console.log("NO SCHEMA");
            }
            console.log("OPTIONS", JSON.stringify(options));
            if (options.error === "no") {
                console.log("Useless informations : just use try catch if you don't want error :)");
            }
        }

        return new Promise((resolve) => {
            let lineReader;
            if (typeof pathToFile == "string") ; else if (Array.isArray(pathToFile)) {
                lineReader = pathToFile;
            }
            let rows = [];
            let lineCounter = 0;
            let firstLine = [];
            const finalJson = [];
            let lineBuffer = [];

            const createFieldsBinding = function (schemaObject, startPath = "") {
                let bindings = [];
                for (const oneElement in schemaObject) {
                    if (Object.prototype.hasOwnProperty.call(schemaObject, oneElement)) {
                        const path = startPath === "" ? `${oneElement}` : `${startPath}${options.privateSeparator}${oneElement}`;
                        if (typeof schemaObject[oneElement] === "object" || Array.isArray(schemaObject[oneElement])) {
                            if (Array.isArray(schemaObject[oneElement])) {
                                bindings.push({
                                    name: oneElement,
                                    path: path,
                                    type: "helper-array"
                                });
                            }
                            bindings = [
                                ...bindings,
                                ...createFieldsBinding(schemaObject[oneElement], path)
                            ];
                        } else {
                            if (Array.isArray(schemaObject) && options.arrayParse && firstLine.includes(schemaObject[oneElement])) {
                                bindings.push({
                                    name: schemaObject[oneElement],
                                    path: path,
                                    value: "string"
                                });
                            } else {
                                if (firstLine.includes(oneElement) || typeof schemaObject[oneElement] === "function") {
                                    bindings.push({
                                        name: oneElement,
                                        path: path,
                                        value: schemaObject[oneElement]
                                    });
                                } else {
                                    bindings.push({
                                        name: oneElement,
                                        path: path,
                                        type: "static",
                                        value: schemaObject[oneElement]
                                    });
                                }
                            }
                        }
                    }
                }
                return bindings;
            };

            const parseLine = async function (line) {
                let obj;
                if (options.debug) ;
                if (typeof schema !== "undefined" && schema !== null && Array.isArray(schema)) {
                    obj = [];
                } else {
                    obj = {};
                }
                const allValues = line.split(options.separator);
                for (const oneRow of rows) {
                    const onePathRow = oneRow.path;
                    const onePathName = oneRow.name;
                    const allPath = onePathRow.split(options.privateSeparator);
                    let currentValue = null;
                    if (typeof oneRow.type === "undefined" || oneRow.type === null) {
                        const schemaValue = oneRow.value;
                        const index = firstLine.findIndex((element) => element === oneRow.name);
                        if (index === -1) {
                            currentValue = schemaValue;
                        } else {
                            currentValue = allValues[index] || "";
                        }
                        // Optionnal parse the value
                        if (options.parse === true) {
                            if (typeof schemaValue !== "undefined") {
                                if (schemaValue === "int") {
                                    currentValue = parseInt(currentValue, 10);
                                } else if (schemaValue === "float") {
                                    currentValue = parseFloat(currentValue);
                                } else if (schemaValue === "string") {
                                    currentValue = currentValue.toString();
                                } else if (typeof schemaValue === "function") {
                                    if (typeof currentValue === "function") {
                                        // When the value is in an array
                                        currentValue = await schemaValue(allValues);
                                    } else {
                                        currentValue = await schemaValue(currentValue);
                                    }
                                }
                            }
                        }
                    } else if (oneRow.type === "helper-array") {
                        // This bug was hard !
                        // We can do currentValue = oneRow.value; for helper-array
                        // Because it's a reference and not a static value, lol, I'm dumb
                        currentValue = [];
                    } else if (oneRow.type === "static") {
                        currentValue = oneRow.value;
                    }
                    let goodPlace = null;
                    if (allPath.length > 1) {
                        goodPlace = obj;
                        const long = allPath.length;
                        for (let count = 0; count < long; count++) {
                            const nextPath = allPath[count];
                            if (count === long - 1) {
                                if (!Array.isArray(goodPlace)) {
                                    goodPlace[nextPath] = "";
                                }
                            } else {
                                if (typeof goodPlace[nextPath] === "undefined") {
                                    goodPlace[nextPath] = {};
                                }
                                goodPlace = goodPlace[nextPath];
                            }
                        }
                        if (goodPlace) {
                            if (Array.isArray(goodPlace)) {
                                goodPlace.push(currentValue);
                            } else if (typeof goodPlace === "object") {
                                goodPlace[onePathName] = currentValue;
                            }
                        } else {
                            goodPlace = currentValue;
                        }
                    } else {
                        obj[onePathRow] = currentValue;
                    }
                }
                return obj;
            };
            const clearBuffer = async () => {
                for (const oneLine of lineBuffer) {
                    let parsedLine = {};
                    if (options.avoidVoidLine === true) {
                        if (oneLine === "" || oneLine === "\n" || oneLine === "\r\n") {
                            continue;
                        }
                    }
                    parsedLine = await parseLine(oneLine);
                    if (typeof options.lineCallBack !== "undefined" && typeof options.lineCallBack === "function") {
                        const resCallback = await options.lineCallBack(parsedLine, oneLine);
                        if (typeof resCallBack === "undefined" && resCallback === null) {
                            if (options.callBackForce) {
                                parsedLine = resCallback;
                            } else {
                                if (options.debug) {
                                    console.error("CallBack force at false and callBack result is not correct");
                                }
                            }
                        }
                    }
                    finalJson.push(parsedLine);
                }
                lineBuffer = []; // Clear the buffer
            };
            const parsefirstLine = async (line) => {
                if (typeof options.overrideFirstLine !== "undefined" && options.overrideFirstLine !== null && Array.isArray(options.overrideFirstLine)) {
                    firstLine = options.overrideFirstLine; // check if same length ?
                } else {
                    firstLine = line.split(options.separator);
                }
                if (typeof schema !== "undefined" && schema !== null) {
                    rows = createFieldsBinding(schema);
                    if (options.debug) {
                        console.log("BINDINGS:", JSON.stringify(rows));
                    }
                } else {
                    // There is no schema
                    rows = firstLine.map((element) => ({
                        name: element,
                        path: element
                    }));
                }
            };
            const reader = async () => {
                for await (const line of lineReader) {
                    if (lineCounter === 0) {
                        lineCounter++;
                        await parsefirstLine(line);
                    } else {
                        lineBuffer.push(line);
                        await clearBuffer();
                    }
                }
                resolve(finalJson);
            };
            reader();
        });
    };

    /* src\App.svelte generated by Svelte v3.38.2 */
    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let div;
    	let h1;
    	let t1;
    	let p0;
    	let t3;
    	let a0;
    	let p1;
    	let t5;
    	let img;
    	let img_src_value;
    	let t6;
    	let p2;
    	let t8;
    	let p3;
    	let t9;
    	let a1;
    	let t11;
    	let table;
    	let thead;
    	let tr0;
    	let th0;
    	let textarea0;
    	let t12;
    	let th1;
    	let pre;
    	let t13_value = JSON.stringify(/*parsed*/ ctx[1], null, 4) + "";
    	let t13;
    	let t14;
    	let tbody;
    	let tr1;
    	let td0;
    	let h20;
    	let t16;
    	let textarea1;
    	let t17;
    	let td1;
    	let h21;
    	let t19;
    	let p4;
    	let t20;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h1 = element("h1");
    			h1.textContent = "Demo of csv-to-custom-json";
    			t1 = space();
    			p0 = element("p");
    			p0.textContent = "Made with";
    			t3 = space();
    			a0 = element("a");
    			p1 = element("p");
    			p1.textContent = "Svelte";
    			t5 = space();
    			img = element("img");
    			t6 = space();
    			p2 = element("p");
    			p2.textContent = "!";
    			t8 = space();
    			p3 = element("p");
    			t9 = text("Check code ");
    			a1 = element("a");
    			a1.textContent = "here";
    			t11 = space();
    			table = element("table");
    			thead = element("thead");
    			tr0 = element("tr");
    			th0 = element("th");
    			textarea0 = element("textarea");
    			t12 = space();
    			th1 = element("th");
    			pre = element("pre");
    			t13 = text(t13_value);
    			t14 = space();
    			tbody = element("tbody");
    			tr1 = element("tr");
    			td0 = element("td");
    			h20 = element("h2");
    			h20.textContent = "Schema";
    			t16 = space();
    			textarea1 = element("textarea");
    			t17 = space();
    			td1 = element("td");
    			h21 = element("h2");
    			h21.textContent = "Errors";
    			t19 = space();
    			p4 = element("p");
    			t20 = text(/*errors*/ ctx[2]);
    			attr_dev(h1, "id", "title");
    			attr_dev(h1, "class", "svelte-py8r85");
    			add_location(h1, file, 33, 1, 645);
    			attr_dev(p0, "class", "inline svelte-py8r85");
    			add_location(p0, file, 34, 1, 693);
    			attr_dev(p1, "class", "inline svelte-py8r85");
    			add_location(p1, file, 41, 2, 818);
    			attr_dev(img, "class", "inline logo svelte-py8r85");
    			if (img.src !== (img_src_value = "https://svelte.dev/favicon.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			add_location(img, file, 42, 2, 849);
    			set_style(a0, "color", "orange");
    			attr_dev(a0, "class", "link svelte-py8r85");
    			attr_dev(a0, "href", "https://svelte.dev");
    			attr_dev(a0, "target", "_blank");
    			add_location(a0, file, 35, 1, 726);
    			attr_dev(p2, "class", "inline svelte-py8r85");
    			add_location(p2, file, 44, 1, 928);
    			attr_dev(a1, "class", "link svelte-py8r85");
    			attr_dev(a1, "href", "https://github.com/Its-Just-Nans/csv-to-custom-json-demo");
    			add_location(a1, file, 46, 13, 985);
    			attr_dev(p3, "class", "inline svelte-py8r85");
    			add_location(p3, file, 45, 1, 953);
    			set_style(div, "text-align", "center");
    			add_location(div, file, 32, 0, 610);
    			attr_dev(textarea0, "class", "textarea svelte-py8r85");
    			attr_dev(textarea0, "placeholder", "Your csv here");
    			add_location(textarea0, file, 57, 4, 1136);
    			attr_dev(th0, "class", "svelte-py8r85");
    			add_location(th0, file, 56, 3, 1127);
    			attr_dev(pre, "id", "parsed-res");
    			attr_dev(pre, "class", "svelte-py8r85");
    			add_location(pre, file, 77, 4, 1571);
    			attr_dev(th1, "class", "svelte-py8r85");
    			add_location(th1, file, 76, 3, 1562);
    			add_location(tr0, file, 55, 2, 1119);
    			add_location(thead, file, 54, 1, 1109);
    			attr_dev(h20, "class", "titleCol svelte-py8r85");
    			add_location(h20, file, 84, 4, 1703);
    			attr_dev(textarea1, "class", "textarea svelte-py8r85");
    			attr_dev(textarea1, "placeholder", "Your schema here");
    			add_location(textarea1, file, 85, 4, 1740);
    			attr_dev(td0, "class", "results svelte-py8r85");
    			add_location(td0, file, 83, 3, 1678);
    			attr_dev(h21, "class", "titleCol svelte-py8r85");
    			add_location(h21, file, 95, 4, 1963);
    			attr_dev(p4, "class", "svelte-py8r85");
    			add_location(p4, file, 96, 4, 2000);
    			attr_dev(td1, "class", "error svelte-py8r85");
    			add_location(td1, file, 94, 3, 1940);
    			add_location(tr1, file, 82, 2, 1670);
    			add_location(tbody, file, 81, 1, 1660);
    			attr_dev(table, "class", "svelte-py8r85");
    			add_location(table, file, 53, 0, 1100);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h1);
    			append_dev(div, t1);
    			append_dev(div, p0);
    			append_dev(div, t3);
    			append_dev(div, a0);
    			append_dev(a0, p1);
    			append_dev(a0, t5);
    			append_dev(a0, img);
    			append_dev(div, t6);
    			append_dev(div, p2);
    			append_dev(div, t8);
    			append_dev(div, p3);
    			append_dev(p3, t9);
    			append_dev(p3, a1);
    			insert_dev(target, t11, anchor);
    			insert_dev(target, table, anchor);
    			append_dev(table, thead);
    			append_dev(thead, tr0);
    			append_dev(tr0, th0);
    			append_dev(th0, textarea0);
    			set_input_value(textarea0, /*csv*/ ctx[0]);
    			append_dev(tr0, t12);
    			append_dev(tr0, th1);
    			append_dev(th1, pre);
    			append_dev(pre, t13);
    			append_dev(table, t14);
    			append_dev(table, tbody);
    			append_dev(tbody, tr1);
    			append_dev(tr1, td0);
    			append_dev(td0, h20);
    			append_dev(td0, t16);
    			append_dev(td0, textarea1);
    			set_input_value(textarea1, /*schema*/ ctx[3]);
    			append_dev(tr1, t17);
    			append_dev(tr1, td1);
    			append_dev(td1, h21);
    			append_dev(td1, t19);
    			append_dev(td1, p4);
    			append_dev(p4, t20);

    			if (!mounted) {
    				dispose = [
    					listen_dev(textarea0, "change", /*handleChange*/ ctx[4], false, false, false),
    					listen_dev(textarea0, "click", /*handleChange*/ ctx[4], false, false, false),
    					listen_dev(textarea0, "keyup", /*handleChange*/ ctx[4], false, false, false),
    					listen_dev(textarea0, "input", /*textarea0_input_handler*/ ctx[5]),
    					listen_dev(textarea1, "change", /*handleChange*/ ctx[4], false, false, false),
    					listen_dev(textarea1, "click", /*handleChange*/ ctx[4], false, false, false),
    					listen_dev(textarea1, "keyup", /*handleChange*/ ctx[4], false, false, false),
    					listen_dev(textarea1, "input", /*textarea1_input_handler*/ ctx[6])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*csv*/ 1) {
    				set_input_value(textarea0, /*csv*/ ctx[0]);
    			}

    			if (dirty & /*parsed*/ 2 && t13_value !== (t13_value = JSON.stringify(/*parsed*/ ctx[1], null, 4) + "")) set_data_dev(t13, t13_value);

    			if (dirty & /*schema*/ 8) {
    				set_input_value(textarea1, /*schema*/ ctx[3]);
    			}

    			if (dirty & /*errors*/ 4) set_data_dev(t20, /*errors*/ ctx[2]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t11);
    			if (detaching) detach_dev(table);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let csv = "num1,num2,num3,num4\n1,2,3,4\n4,5,6,7\n7,8,9,10";
    	let parsed = "";
    	let errors = "";

    	let schema = JSON.stringify(
    		{
    			num1: "string",
    			anObject: { num1: "int", num2: "int", num3: "string" },
    			anArray: ["num3"]
    		},
    		null,
    		4
    	);

    	const handleChange = async () => {
    		try {
    			const schemaObj = JSON.parse(schema);
    			$$invalidate(1, parsed = await parseFile(csv.split("\n"), schemaObj, { avoidVoidLine: true }));
    			$$invalidate(2, errors = []);
    		} catch(e) {
    			$$invalidate(2, errors = "Error parsing");
    		}
    	};

    	setTimeout(handleChange, 500);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function textarea0_input_handler() {
    		csv = this.value;
    		$$invalidate(0, csv);
    	}

    	function textarea1_input_handler() {
    		schema = this.value;
    		$$invalidate(3, schema);
    	}

    	$$self.$capture_state = () => ({
    		parser: parseFile,
    		csv,
    		parsed,
    		errors,
    		schema,
    		handleChange
    	});

    	$$self.$inject_state = $$props => {
    		if ("csv" in $$props) $$invalidate(0, csv = $$props.csv);
    		if ("parsed" in $$props) $$invalidate(1, parsed = $$props.parsed);
    		if ("errors" in $$props) $$invalidate(2, errors = $$props.errors);
    		if ("schema" in $$props) $$invalidate(3, schema = $$props.schema);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		csv,
    		parsed,
    		errors,
    		schema,
    		handleChange,
    		textarea0_input_handler,
    		textarea1_input_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
