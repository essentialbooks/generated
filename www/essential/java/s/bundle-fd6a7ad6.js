var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
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
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function action_destroyer(action_result) {
        return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
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
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
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
    function xlink_attr(node, attribute, value) {
        node.setAttributeNS('http://www.w3.org/1999/xlink', attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }
    class HtmlTag {
        constructor(anchor = null) {
            this.a = anchor;
            this.e = this.n = null;
        }
        m(html, target, anchor = null) {
            if (!this.e) {
                this.e = element(target.nodeName);
                this.t = target;
                this.h(html);
            }
            this.i(anchor);
        }
        h(html) {
            this.e.innerHTML = html;
            this.n = Array.from(this.e.childNodes);
        }
        i(anchor) {
            for (let i = 0; i < this.n.length; i += 1) {
                insert(this.t, this.n[i], anchor);
            }
        }
        p(html) {
            this.d();
            this.h(html);
            this.i(this.a);
        }
        d() {
            this.n.forEach(detach);
        }
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function beforeUpdate(fn) {
        get_current_component().$$.before_update.push(fn);
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
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
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function destroy_block(block, lookup) {
        block.d(1);
        lookup.delete(block.key);
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error(`Cannot have duplicate keys in a keyed each`);
            }
            keys.add(key);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
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
        const prop_values = options.props || {};
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
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
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
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
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
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.24.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const idxURL = 0;
    const idxParentIdx = 1;
    const idxFirstChildIdx = 2;
    const idxTitle = 3;

    // index of the parent in the array of all items
    function parentIdx(item) {
      return item[idxParentIdx];
    }

    function hasChildren(item) {
      return item[idxFirstChildIdx] != -1;
    }

    function parent(item) {
      var idx = parentIdx(item);
      if (idx == -1) {
        return null;
      }
      return gTocItems[idx];
    }

    // "the-go-command-f2028ab74a354cf2ba6a86acfb813356"
    function url(item) {
      while (item) {
        var uri = item[idxURL];
        // toc items that refer to items within the page
        // inherit
        if (uri != "") {
          return uri;
        }
        item = parent(item);
      }
      return "";
    }

    // all searchable items: title + search synonyms
    function searchable(item) {
      return item.slice(idxTitle);
    }

    function isRoot(item) {
      return parentIdx(item) == -1;
    }

    function title(item) {
      return item[idxTitle];
    }

    const parentIdxToChildren = {};

    const emptyArray = [];

    // returns an array of indexes of children in gTocItems
    function childrenForParentIdx(parentIdx, firstChildIdx = 0) {
      if (firstChildIdx == -1) {
        // re-use empty array. caller should not modify
        return emptyArray;
      }
      const children = parentIdxToChildren[parentIdx];
      if (children) {
        return children;
      }
      const n = gTocItems.length;
      let res = [];
      for (let i = firstChildIdx; i < n; i++) {
        const tocItem = gTocItems[i];
        if (parentIdx === item.parentIdx(tocItem)) {
          res.push(i);
        }
      }
      parentIdxToChildren[parentIdx] = res;
      return res;
    }

    // returns true if has children and some of them articles
    // (as opposed to children that are headers within articles)
    function hasArticleChildren(item) {
      const idx = item[idxFirstChildIdx];
      if (idx == -1) {
        return false;
      }
      var item = gTocItems[idx];
      var parentIdx = item[idxParentIdx];
      while (idx < gTocItems.length) {
        item = gTocItems[idx];
        if (parentIdx != item[idxParentIdx]) {
          return false;
        }
        var uri = item[idxURL];
        if (uri.indexOf("#") === -1) {
          return true;
        }
        idx += 1;
      }
      return false;
    }

    const item = {
      url: url,
      parentIdx: parentIdx,
      parent: parent,
      title: title,
      childrenForParentIdx: childrenForParentIdx,
      hasChildren: hasChildren,
      searchable: searchable,
      isRoot: isRoot,
      hasArticleChildren: hasArticleChildren,
    };

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    // idx of currently selected toc item. there is only one.
    // we use global variable so that all TocItem instances
    // can set their state based on this
    const currentlySelectedIdx = writable(-1);

    const tocItemIdxToScroll = writable(-1);

    function storeSet(key, val) {
        if (window.localStorage) {
            window.localStorage.setItem(key, val);
        }
    }

    function storeClear(key) {
        if (window.localStorage) {
            window.localStorage.removeItem(key);
        }
    }

    function storeGet(key) {
        if (window.localStorage) {
            return window.localStorage.getItem(key);
        }
        return "";
    }

    var keyScrollPos = "scrollPos";
    var keyIndexView = "indexView";

    function scrollPosSet(pos) {
        storeSet(keyScrollPos, pos);
    }

    function scrollPosGet(pos) {
        return storeGet(keyScrollPos);
    }

    function scrollPosClear() {
        storeClear(keyScrollPos);
    }

    function viewSet(view) {
        storeSet(keyIndexView, view);
    }

    function viewGet() {
        return storeGet(keyIndexView);
    }

    function viewClear() {
        storeClear(keyIndexView);
    }

    function getLocationLastElement() {
      var loc = window.location.pathname;
      var parts = loc.split("/");
      var lastIdx = parts.length - 1;
      return parts[lastIdx];
    }

    function getLocationLastElementWithHash() {
      var loc = window.location.pathname;
      var parts = loc.split("/");
      var lastIdx = parts.length - 1;
      return parts[lastIdx] + window.location.hash;
    }

    // TODO: maybe move to item.js
    // remembers which toc items are expanded, by their index
    let tocItemIdxExpanded = [];

    function isTocItemExpanded(idx) {
      for (let i of tocItemIdxExpanded) {
        if (i === idx) {
          return true;
        }
      }
      return false;
    }

    function setIsExpandedUpwards(idx) {
      const tocItem = gTocItems[idx];
      tocItemIdxExpanded.push(idx);
      // console.log(`idx: ${idx}, title: ${tocItem[4]}`)
      const newIdx = item.parentIdx(tocItem);
      if (newIdx != -1) {
        setIsExpandedUpwards(newIdx);
      }
    }

    function findTocIdxForCurrentURL() {
      const currURI = getLocationLastElementWithHash();
      const n = gTocItems.length;
      let tocItem, uri;
      for (let idx = 0; idx < n; idx++) {
        tocItem = gTocItems[idx];
        uri = item.url(tocItem);
        if (uri === currURI) {
          return idx;
        }
      }
      return -1;
    }

    function setTocExpandedForCurrentURL() {
      tocItemIdxExpanded = [];
      const idx = findTocIdxForCurrentURL();
      if (idx == -1) {
        return 0;
      }

      currentlySelectedIdx.set(idx);
      setIsExpandedUpwards(idx);
      return idx;
    }

    // returns a debouncer function. Usage:
    // var debouncer = makeDebouncer(250);
    // function fn() { ... }
    // debouncer(fn)
    function makeDebouncer(timeInMs) {
      let interval;
      return function (f) {
        clearTimeout(interval);
        interval = setTimeout(() => {
          interval = null;
          f();
        }, timeInMs);
      };
    }

    /* fe\TocItem.svelte generated by Svelte v3.24.0 */
    const file = "fe\\TocItem.svelte";

    // (77:2) {:else}
    function create_else_block_1(ctx) {
    	let svg;
    	let use;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			use = svg_element("use");
    			xlink_attr(use, "xlink:href", "#arrow-not-expanded");
    			add_location(use, file, 78, 6, 2052);
    			attr_dev(svg, "class", "arrow");
    			add_location(svg, file, 77, 4, 2002);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, use);

    			if (!mounted) {
    				dispose = listen_dev(svg, "click", /*toggleExpand*/ ctx[8], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(77:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (73:23) 
    function create_if_block_3(ctx) {
    	let svg;
    	let use;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			use = svg_element("use");
    			xlink_attr(use, "xlink:href", "#arrow-expanded");
    			add_location(use, file, 74, 6, 1940);
    			attr_dev(svg, "class", "arrow");
    			add_location(svg, file, 73, 4, 1890);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, use);

    			if (!mounted) {
    				dispose = listen_dev(svg, "click", /*toggleExpand*/ ctx[8], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(73:23) ",
    		ctx
    	});

    	return block;
    }

    // (71:2) {#if !hasChildren}
    function create_if_block_2(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "toc-nav-empty-arrow");
    			add_location(div, file, 71, 4, 1826);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(71:2) {#if !hasChildren}",
    		ctx
    	});

    	return block;
    }

    // (85:2) {:else}
    function create_else_block(ctx) {
    	let a;
    	let t;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			a = element("a");
    			t = text(/*title*/ ctx[5]);
    			attr_dev(a, "class", "toc-link");
    			attr_dev(a, "title", /*title*/ ctx[5]);
    			attr_dev(a, "href", /*url*/ ctx[6]);
    			add_location(a, file, 85, 4, 2165);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, t);

    			if (!mounted) {
    				dispose = listen_dev(a, "click", /*linkClicked*/ ctx[9], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(85:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (83:2) {#if isSelected}
    function create_if_block_1(ctx) {
    	let b;

    	const block = {
    		c: function create() {
    			b = element("b");
    			b.textContent = `${/*title*/ ctx[5]}`;
    			add_location(b, file, 83, 4, 2136);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, b, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(b);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(83:2) {#if isSelected}",
    		ctx
    	});

    	return block;
    }

    // (90:0) {#if hasChildren && isExpanded}
    function create_if_block(ctx) {
    	let toc;
    	let current;

    	toc = new Toc({
    			props: {
    				parentIdx: /*itemIdx*/ ctx[0],
    				level: /*level*/ ctx[1] + 1
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(toc.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(toc, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const toc_changes = {};
    			if (dirty & /*itemIdx*/ 1) toc_changes.parentIdx = /*itemIdx*/ ctx[0];
    			if (dirty & /*level*/ 2) toc_changes.level = /*level*/ ctx[1] + 1;
    			toc.$set(toc_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(toc.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(toc.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(toc, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(90:0) {#if hasChildren && isExpanded}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div;
    	let t0;
    	let div_class_value;
    	let t1;
    	let if_block2_anchor;
    	let current;

    	function select_block_type(ctx, dirty) {
    		if (!/*hasChildren*/ ctx[7]) return create_if_block_2;
    		if (/*isExpanded*/ ctx[3]) return create_if_block_3;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (/*isSelected*/ ctx[4]) return create_if_block_1;
    		return create_else_block;
    	}

    	let current_block_type_1 = select_block_type_1(ctx);
    	let if_block1 = current_block_type_1(ctx);
    	let if_block2 = /*hasChildren*/ ctx[7] && /*isExpanded*/ ctx[3] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block0.c();
    			t0 = space();
    			if_block1.c();
    			t1 = space();
    			if (if_block2) if_block2.c();
    			if_block2_anchor = empty();
    			attr_dev(div, "class", div_class_value = "toc-item lvl" + /*level*/ ctx[1]);
    			add_location(div, file, 69, 0, 1747);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_block0.m(div, null);
    			append_dev(div, t0);
    			if_block1.m(div, null);
    			/*div_binding*/ ctx[10](div);
    			insert_dev(target, t1, anchor);
    			if (if_block2) if_block2.m(target, anchor);
    			insert_dev(target, if_block2_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div, t0);
    				}
    			}

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_1(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type_1(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(div, null);
    				}
    			}

    			if (!current || dirty & /*level*/ 2 && div_class_value !== (div_class_value = "toc-item lvl" + /*level*/ ctx[1])) {
    				attr_dev(div, "class", div_class_value);
    			}

    			if (/*hasChildren*/ ctx[7] && /*isExpanded*/ ctx[3]) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);

    					if (dirty & /*isExpanded*/ 8) {
    						transition_in(if_block2, 1);
    					}
    				} else {
    					if_block2 = create_if_block(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(if_block2_anchor.parentNode, if_block2_anchor);
    				}
    			} else if (if_block2) {
    				group_outros();

    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block2);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block2);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_block0.d();
    			if_block1.d();
    			/*div_binding*/ ctx[10](null);
    			if (detaching) detach_dev(t1);
    			if (if_block2) if_block2.d(detaching);
    			if (detaching) detach_dev(if_block2_anchor);
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
    	let { itemIdx = -1 } = $$props;
    	let { level = 0 } = $$props;
    	let element;
    	const loc = getLocationLastElementWithHash();
    	const tocItem = gTocItems[itemIdx];
    	const title = item.title(tocItem);
    	const url = item.url(tocItem);
    	const hasChildren = item.hasChildren(tocItem);

    	// let isExpanded = loc.startsWith(url);
    	let isExpanded = isTocItemExpanded(itemIdx);

    	let isSelected = url === loc;

    	currentlySelectedIdx.subscribe(idx => {
    		$$invalidate(4, isSelected = idx == itemIdx);
    	});

    	tocItemIdxToScroll.subscribe(idx => {
    		if (idx === itemIdx) {
    			// console.log("tocItemIdxToScroll: idx", idx);
    			element.scrollIntoView(true);

    			tocItemIdxToScroll.set(-2);
    		}
    	});

    	function toggleExpand() {
    		$$invalidate(3, isExpanded = !isExpanded);
    	} // console.log("toogleExpand(): ", isExpanded);

    	function linkClicked() {
    		var el = document.getElementById("toc");
    		scrollPosSet(el.scrollTop);
    		currentlySelectedIdx.set(itemIdx);
    	} // console.log("TocItem.linkClicked, scrollTop:", el.scrollTop);

    	const writable_props = ["itemIdx", "level"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<TocItem> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("TocItem", $$slots, []);

    	function div_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			element = $$value;
    			$$invalidate(2, element);
    		});
    	}

    	$$self.$set = $$props => {
    		if ("itemIdx" in $$props) $$invalidate(0, itemIdx = $$props.itemIdx);
    		if ("level" in $$props) $$invalidate(1, level = $$props.level);
    	};

    	$$self.$capture_state = () => ({
    		Toc,
    		item,
    		scrollPosSet,
    		currentlySelectedIdx,
    		tocItemIdxToScroll,
    		isTocItemExpanded,
    		getLocationLastElementWithHash,
    		itemIdx,
    		level,
    		element,
    		loc,
    		tocItem,
    		title,
    		url,
    		hasChildren,
    		isExpanded,
    		isSelected,
    		toggleExpand,
    		linkClicked
    	});

    	$$self.$inject_state = $$props => {
    		if ("itemIdx" in $$props) $$invalidate(0, itemIdx = $$props.itemIdx);
    		if ("level" in $$props) $$invalidate(1, level = $$props.level);
    		if ("element" in $$props) $$invalidate(2, element = $$props.element);
    		if ("isExpanded" in $$props) $$invalidate(3, isExpanded = $$props.isExpanded);
    		if ("isSelected" in $$props) $$invalidate(4, isSelected = $$props.isSelected);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		itemIdx,
    		level,
    		element,
    		isExpanded,
    		isSelected,
    		title,
    		url,
    		hasChildren,
    		toggleExpand,
    		linkClicked,
    		div_binding
    	];
    }

    class TocItem extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { itemIdx: 0, level: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TocItem",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get itemIdx() {
    		throw new Error("<TocItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set itemIdx(value) {
    		throw new Error("<TocItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get level() {
    		throw new Error("<TocItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set level(value) {
    		throw new Error("<TocItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* fe\Toc.svelte generated by Svelte v3.24.0 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    // (49:0) {#each children as itemIdx}
    function create_each_block(ctx) {
    	let tocitem;
    	let current;

    	tocitem = new TocItem({
    			props: {
    				itemIdx: /*itemIdx*/ ctx[4],
    				level: /*level*/ ctx[0]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(tocitem.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(tocitem, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const tocitem_changes = {};
    			if (dirty & /*level*/ 1) tocitem_changes.level = /*level*/ ctx[0];
    			tocitem.$set(tocitem_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tocitem.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tocitem.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(tocitem, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(49:0) {#each children as itemIdx}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let each_1_anchor;
    	let current;
    	let each_value = /*children*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*children, level*/ 3) {
    				each_value = /*children*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { parentIdx = -1 } = $$props;
    	let { level = 0 } = $$props;
    	let currentlySelectedIdx = -1;
    	const children = item.childrenForParentIdx(parentIdx);

    	onMount(() => {
    		// when we mount top-level Toc, scroll toc item into view
    		if (parentIdx !== -1) {
    			return;
    		}

    		// if we explicitly remembered toc scroll position, restore it
    		const scrollTop = scrollPosGet() || -1;

    		if (scrollTop >= 0) {
    			// console.log("scrollTop:", scrollTop);
    			const el = document.getElementById("toc");

    			el.scrollTop = scrollTop;
    			scrollPosClear();
    			tocItemIdxToScroll.set(-2);
    			return;
    		}

    		// otherwise tell currently selected TocItem to scroll
    		// itself into view.
    		tocItemIdxToScroll.set(currentlySelectedIdx);
    	});

    	if (parentIdx === -1) {
    		// initial setup
    		const loc = getLocationLastElementWithHash();

    		// console.log(`loc: ${loc}`);
    		currentlySelectedIdx = setTocExpandedForCurrentURL();

    		window.onhashchange = setTocExpandedForCurrentURL;
    	}

    	const writable_props = ["parentIdx", "level"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Toc> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Toc", $$slots, []);

    	$$self.$set = $$props => {
    		if ("parentIdx" in $$props) $$invalidate(2, parentIdx = $$props.parentIdx);
    		if ("level" in $$props) $$invalidate(0, level = $$props.level);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		TocItem,
    		item,
    		getLocationLastElementWithHash,
    		setTocExpandedForCurrentURL,
    		scrollPosGet,
    		scrollPosClear,
    		tocItemIdxToScroll,
    		parentIdx,
    		level,
    		currentlySelectedIdx,
    		children
    	});

    	$$self.$inject_state = $$props => {
    		if ("parentIdx" in $$props) $$invalidate(2, parentIdx = $$props.parentIdx);
    		if ("level" in $$props) $$invalidate(0, level = $$props.level);
    		if ("currentlySelectedIdx" in $$props) currentlySelectedIdx = $$props.currentlySelectedIdx;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [level, children, parentIdx];
    }

    class Toc extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { parentIdx: 2, level: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Toc",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get parentIdx() {
    		throw new Error("<Toc>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set parentIdx(value) {
    		throw new Error("<Toc>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get level() {
    		throw new Error("<Toc>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set level(value) {
    		throw new Error("<Toc>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const maxSearchResults = 25;

    // el is [idx, len]
    // sort by idx.
    // if idx is the same, sort by reverse len
    // (i.e. bigger len is first)
    function sortSearchByIdx(el1, el2) {
    	var res = el1[0] - el2[0];
    	if (res == 0) {
    		res = el2[1] - el1[1];
    	}
    	return res;
    }

    // [[idx, len], ...]
    // sort by idx, if there is an overlap, drop overlapped elements
    function sortSearchMatches(a) {
    	if (a.length < 2) {
    		return a;
    	}
    	a.sort(sortSearchByIdx);
    	var lastIdx = a[0][0] + a[0][1]; // start + len
    	var n = a.length;
    	var res = [a[0]];
    	for (var i = 1; i < n; i++) {
    		var el = a[i];
    		var idx = el[0];
    		var len = el[1];
    		if (idx >= lastIdx) {
    			res.push(el);
    			lastIdx = idx + len;
    		}
    	}
    	return a;
    }

    // searches s for toFind and toFindArr.
    // returns null if no match
    // returns array of [idx, len] position in $s where $toFind or $toFindArr matches
    function searchMatch(s, toFind, toFindArr) {
    	s = s.toLowerCase();

    	// try exact match
    	var idx = s.indexOf(toFind);
    	if (idx != -1) {
    		return [[idx, toFind.length]];
    	}

    	// now see if matches for search for AND of components in toFindArr
    	if (!toFindArr) {
    		return null;
    	}

    	var n = toFindArr.length;
    	var res = Array(n);
    	for (var i = 0; i < n; i++) {
    		toFind = toFindArr[i];
    		idx = s.indexOf(toFind);
    		if (idx == -1) {
    			return null;
    		}
    		res[i] = [idx, toFind.length];
    	}
    	return sortSearchMatches(res);
    }

    function notEmptyString(s) {
    	return s.length > 0;
    }

    /*
    returns null if no match
    returns: {
      term: "",
      match: [[idx, len], ...]
    }
    */
    function searchMatchMulti(toSearchArr, toFind) {
    	var toFindArr = toFind.split(" ").filter(notEmptyString);
    	var n = toSearchArr.length;
    	for (var i = 0; i < n; i++) {
    		var toSearch = toSearchArr[i];
    		var match = searchMatch(toSearch, toFind, toFindArr);
    		if (match) {
    			return {
    				term: toSearch,
    				match: match,
    				tocItem: null // will be filled later
    			};
    		}
    	}
    	return null;
    }

    // if search term is multiple words like "blank id",
    // we search for both the exact match and if we match all
    // terms ("blank", "id") separately
    function search(searchTerm) {
    	// console.log("search for:", searchTerm);
    	const a = gTocItems; // loaded via toc_search.js, generated in gen_book_toc_search.go
    	const n = a.length;
    	const res = [];
    	for (let i = 0; i < n && res.length < maxSearchResults; i++) {
    		var tocItem = a[i];
    		var searchable = item.searchable(tocItem);
    		var match = searchMatchMulti(searchable, searchTerm);
    		if (!match) {
    			continue;
    		}
    		match.tocItem = tocItem;
    		match.id = i;
    		res.push(match);
    	}
    	return res;
    }

    /* fe\Overlay.svelte generated by Svelte v3.24.0 */

    const { Error: Error_1 } = globals;
    const file$1 = "fe\\Overlay.svelte";

    function create_fragment$2(ctx) {
    	let div;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*$$slots*/ ctx[6].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[5], null);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			attr_dev(div, "class", "overlay svelte-ci664z");
    			add_location(div, file$1, 38, 0, 613);
    		},
    		l: function claim(nodes) {
    			throw new Error_1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			/*div_binding*/ ctx[7](div);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(div, "click", /*handleClick*/ ctx[2], false, false, false),
    					listen_dev(div, "keydown", /*handleKeyDown*/ ctx[1], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 32) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[5], dirty, null, null);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    			/*div_binding*/ ctx[7](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { ondismiss = null } = $$props; // function
    	let { dismissWithEsc = false } = $$props;

    	if (!ondismiss) {
    		throw new Error("ondimiss property is requred");
    	}

    	let overlay;

    	function handleKeyDown(ev) {
    		if (dismissWithEsc && ev.which === 27) {
    			ondismiss();
    		}
    	}

    	function handleClick(ev) {
    		if (ev.target !== overlay) {
    			// clicked outside of the overlay
    			return;
    		}

    		ondismiss();
    	}

    	const writable_props = ["ondismiss", "dismissWithEsc"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Overlay> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Overlay", $$slots, ['default']);

    	function div_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			overlay = $$value;
    			$$invalidate(0, overlay);
    		});
    	}

    	$$self.$set = $$props => {
    		if ("ondismiss" in $$props) $$invalidate(3, ondismiss = $$props.ondismiss);
    		if ("dismissWithEsc" in $$props) $$invalidate(4, dismissWithEsc = $$props.dismissWithEsc);
    		if ("$$scope" in $$props) $$invalidate(5, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		ondismiss,
    		dismissWithEsc,
    		overlay,
    		handleKeyDown,
    		handleClick
    	});

    	$$self.$inject_state = $$props => {
    		if ("ondismiss" in $$props) $$invalidate(3, ondismiss = $$props.ondismiss);
    		if ("dismissWithEsc" in $$props) $$invalidate(4, dismissWithEsc = $$props.dismissWithEsc);
    		if ("overlay" in $$props) $$invalidate(0, overlay = $$props.overlay);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		overlay,
    		handleKeyDown,
    		handleClick,
    		ondismiss,
    		dismissWithEsc,
    		$$scope,
    		$$slots,
    		div_binding
    	];
    }

    class Overlay extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { ondismiss: 3, dismissWithEsc: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Overlay",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get ondismiss() {
    		throw new Error_1("<Overlay>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set ondismiss(value) {
    		throw new Error_1("<Overlay>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dismissWithEsc() {
    		throw new Error_1("<Overlay>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dismissWithEsc(value) {
    		throw new Error_1("<Overlay>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    //. values to test against event.which
    const Escape = 27;
    const Enter = 13;

    function isEsc(ev) {
        return ev.which === Escape;
    }

    function isEnter(ev) {
        return ev.which === Enter;
    }

    function isUp(ev) {
        return (ev.key == "ArrowUp") || (ev.key == "Up");
    }

    function isDown(ev) {
        return (ev.key == "ArrowDown") || (ev.key == "Down");
    }

    // navigation up is: Up or Ctrl-P
    function isNavUp(ev) {
        if (isUp(ev)) {
            return true;
        }
        return ev.ctrlKey && (ev.keyCode === 80);
    }

    // navigation down is: Down or Ctrl-N
    function isNavDown(ev) {
        if (isDown(ev)) {
            return true;
        }
        return ev.ctrlKey && (ev.keyCode === 78);
    }

    function scrollintoview(node) {
      // TODO: test on Safari
      // https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView
      node.scrollIntoView(false);
    }

    /* fe\SearchResults.svelte generated by Svelte v3.24.0 */

    const { Error: Error_1$1 } = globals;
    const file$2 = "fe\\SearchResults.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[19] = list[i];
    	child_ctx[21] = i;
    	return child_ctx;
    }

    // (304:6) {:else}
    function create_else_block$1(ctx) {
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_1_anchor;
    	let each_value = /*results*/ ctx[2];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*r*/ ctx[19].id;
    	validate_each_keys(ctx, each_value, get_each_context$1, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$1(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$1(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*clicked, results, getWhere, hiliHTML, selectedIdx, mouseEnter*/ 245) {
    				const each_value = /*results*/ ctx[2];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context$1, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, each_1_anchor.parentNode, destroy_block, create_each_block$1, each_1_anchor, get_each_context$1);
    			}
    		},
    		d: function destroy(detaching) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(304:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (302:6) {#if results.length === 0}
    function create_if_block$1(ctx) {
    	let div;
    	let t0;
    	let t1;
    	let t2;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t0 = text("No search results for '");
    			t1 = text(/*searchTerm*/ ctx[3]);
    			t2 = text("'");
    			attr_dev(div, "class", "no-results svelte-1smvt2d");
    			add_location(div, file$2, 302, 8, 7260);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t0);
    			append_dev(div, t1);
    			append_dev(div, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*searchTerm*/ 8) set_data_dev(t1, /*searchTerm*/ ctx[3]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(302:6) {#if results.length === 0}",
    		ctx
    	});

    	return block;
    }

    // (314:10) {:else}
    function create_else_block_1$1(ctx) {
    	let div;
    	let html_tag;
    	let raw_value = /*hiliHTML*/ ctx[5](/*idx*/ ctx[21]) + "";
    	let t0;
    	let span;
    	let t1_value = /*getWhere*/ ctx[4](/*idx*/ ctx[21]) + "";
    	let t1;
    	let t2;
    	let mounted;
    	let dispose;

    	function click_handler_1(...args) {
    		return /*click_handler_1*/ ctx[9](/*idx*/ ctx[21], ...args);
    	}

    	function mouseenter_handler(...args) {
    		return /*mouseenter_handler*/ ctx[10](/*idx*/ ctx[21], ...args);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			t0 = space();
    			span = element("span");
    			t1 = text(t1_value);
    			t2 = space();
    			html_tag = new HtmlTag(t0);
    			attr_dev(span, "class", "in svelte-1smvt2d");
    			add_location(span, file$2, 318, 14, 7835);
    			add_location(div, file$2, 314, 12, 7683);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			html_tag.m(raw_value, div);
    			append_dev(div, t0);
    			append_dev(div, span);
    			append_dev(span, t1);
    			append_dev(div, t2);

    			if (!mounted) {
    				dispose = [
    					listen_dev(div, "click", click_handler_1, false, false, false),
    					listen_dev(div, "mouseenter", mouseenter_handler, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*results*/ 4 && raw_value !== (raw_value = /*hiliHTML*/ ctx[5](/*idx*/ ctx[21]) + "")) html_tag.p(raw_value);
    			if (dirty & /*results*/ 4 && t1_value !== (t1_value = /*getWhere*/ ctx[4](/*idx*/ ctx[21]) + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1$1.name,
    		type: "else",
    		source: "(314:10) {:else}",
    		ctx
    	});

    	return block;
    }

    // (306:10) {#if idx === selectedIdx}
    function create_if_block_1$1(ctx) {
    	let div;
    	let html_tag;
    	let raw_value = /*hiliHTML*/ ctx[5](/*idx*/ ctx[21]) + "";
    	let t0;
    	let span;
    	let t1_value = /*getWhere*/ ctx[4](/*idx*/ ctx[21]) + "";
    	let t1;
    	let t2;
    	let scrollintoview_action;
    	let mounted;
    	let dispose;

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[8](/*idx*/ ctx[21], ...args);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			t0 = space();
    			span = element("span");
    			t1 = text(t1_value);
    			t2 = space();
    			html_tag = new HtmlTag(t0);
    			attr_dev(span, "class", "in svelte-1smvt2d");
    			add_location(span, file$2, 311, 14, 7594);
    			attr_dev(div, "class", "selected svelte-1smvt2d");
    			add_location(div, file$2, 306, 12, 7430);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			html_tag.m(raw_value, div);
    			append_dev(div, t0);
    			append_dev(div, span);
    			append_dev(span, t1);
    			append_dev(div, t2);

    			if (!mounted) {
    				dispose = [
    					action_destroyer(scrollintoview_action = scrollintoview.call(null, div)),
    					listen_dev(div, "click", click_handler, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*results*/ 4 && raw_value !== (raw_value = /*hiliHTML*/ ctx[5](/*idx*/ ctx[21]) + "")) html_tag.p(raw_value);
    			if (dirty & /*results*/ 4 && t1_value !== (t1_value = /*getWhere*/ ctx[4](/*idx*/ ctx[21]) + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(306:10) {#if idx === selectedIdx}",
    		ctx
    	});

    	return block;
    }

    // (305:8) {#each results as r, idx (r.id)}
    function create_each_block$1(key_1, ctx) {
    	let first;
    	let if_block_anchor;

    	function select_block_type_1(ctx, dirty) {
    		if (/*idx*/ ctx[21] === /*selectedIdx*/ ctx[0]) return create_if_block_1$1;
    		return create_else_block_1$1;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			if_block.c();
    			if_block_anchor = empty();
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(305:8) {#each results as r, idx (r.id)}",
    		ctx
    	});

    	return block;
    }

    // (299:0) <Overlay {ondismiss} dismissWithEsc={true}>
    function create_default_slot(ctx) {
    	let div2;
    	let div0;
    	let t0;
    	let div1;

    	function select_block_type(ctx, dirty) {
    		if (/*results*/ ctx[2].length === 0) return create_if_block$1;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			if_block.c();
    			t0 = space();
    			div1 = element("div");
    			div1.textContent = "↑ ↓ to navigate     ↵ to select\n          Esc to close";
    			attr_dev(div0, "class", "results svelte-1smvt2d");
    			add_location(div0, file$2, 300, 4, 7197);
    			attr_dev(div1, "class", "help svelte-1smvt2d");
    			add_location(div1, file$2, 324, 4, 7953);
    			attr_dev(div2, "class", "wrapper svelte-1smvt2d");
    			add_location(div2, file$2, 299, 2, 7171);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			if_block.m(div0, null);
    			append_dev(div2, t0);
    			append_dev(div2, div1);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div0, null);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(299:0) <Overlay {ondismiss} dismissWithEsc={true}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let overlay;
    	let current;

    	overlay = new Overlay({
    			props: {
    				ondismiss: /*ondismiss*/ ctx[1],
    				dismissWithEsc: true,
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(overlay.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error_1$1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(overlay, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const overlay_changes = {};
    			if (dirty & /*ondismiss*/ 2) overlay_changes.ondismiss = /*ondismiss*/ ctx[1];

    			if (dirty & /*$$scope, searchTerm, results, selectedIdx*/ 4194317) {
    				overlay_changes.$$scope = { dirty, ctx };
    			}

    			overlay.$set(overlay_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(overlay.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(overlay.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(overlay, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function hilightSearchResult(txt, matches) {
    	var prevIdx = 0;
    	var n = matches.length;
    	var res = "";
    	var s = "";

    	// alternate non-higlighted and highlihted strings
    	for (var i = 0; i < n; i++) {
    		var el = matches[i];
    		var idx = el[0];
    		var len = el[1];
    		var nonHilightLen = idx - prevIdx;

    		if (nonHilightLen > 0) {
    			s = txt.substring(prevIdx, prevIdx + nonHilightLen);
    			res += `<span>${s}</span>`;
    		}

    		s = txt.substring(idx, idx + len);
    		res += `<span class="hili">${s}</span>`;
    		prevIdx = idx + len;
    	}

    	var txtLen = txt.length;
    	nonHilightLen = txtLen - prevIdx;

    	if (nonHilightLen > 0) {
    		s = txt.substring(prevIdx, prevIdx + nonHilightLen);
    		res += `<span>${s}</span>`;
    	}

    	return res;
    }

    function isChapterOrArticleURL(s) {
    	var isChapterOrArticle = s.indexOf("#") === -1;
    	return isChapterOrArticle;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { ondismiss = null } = $$props; // function

    	if (!ondismiss) {
    		throw new Error("ondimiss property is requred");
    	}

    	let { results = [] } = $$props;
    	let { selectedIdx = 0 } = $$props;
    	let { searchTerm = "" } = $$props;
    	let ignoreNextMouseEnter = false;
    	let prevResulutsCount = 0;

    	// TODO: I don't quite understand when beforeUpdate / afterUpdate
    	// are called. Maybe just clamp selectedIdx to be within
    	// results in afterUpdate
    	beforeUpdate(() => {
    		//console.log("before:", prevResulutsCount);
    		if (results.length !== prevResulutsCount) {
    			$$invalidate(0, selectedIdx = 0);
    			prevResulutsCount = results.length;
    		}
    	});

    	afterUpdate(() => {
    		// reset which item is selected when the number
    		// of search results changes
    		// console.log("after:", results.length);
    		if (results.length !== prevResulutsCount) {
    			$$invalidate(0, selectedIdx = 0);
    			prevResulutsCount = results.length;
    		}
    	});

    	// must add them globally to be called even when search
    	// input field has focus
    	onMount(() => {
    		// console.log("SearchResults term:", searchTerm, "results:", results.length);
    		document.addEventListener("keydown", keyDown);
    	});

    	onDestroy(() => {
    		document.removeEventListener("keydown", keyDown);
    	});

    	function getParentTitle(tocItem) {
    		var res = "";
    		var parent = item.parent(tocItem);

    		while (parent) {
    			var s = item.title(parent);

    			if (res) {
    				s = s + " / ";
    			}

    			res = s + res;
    			parent = item.parent(parent);
    		}

    		return res;
    	}

    	// return true if term is a search synonym inside tocItem
    	function isMatchSynonym(tocItem, term) {
    		term = term.toLowerCase();
    		var title = item.title(tocItem).toLowerCase();
    		return title != term;
    	}

    	// if search matched synonym returns "${chapterTitle} / ${articleTitle}"
    	// otherwise empty string
    	function getArticlePath(tocItem, term) {
    		if (!isMatchSynonym(tocItem, term)) {
    			return null;
    		}

    		var title = item.title(tocItem);
    		var parentTitle = getParentTitle(tocItem);

    		if (parentTitle == "") {
    			return title;
    		}

    		return parentTitle + " / " + title;
    	}

    	function getWhere(idx) {
    		const r = results[idx];
    		var tocItem = r.tocItem;
    		var term = r.term;

    		// TODO: get multi-level path (e.g. for 'json' where in Refelection / Uses for reflection chapter)
    		const inTxt = getArticlePath(tocItem, term);

    		if (inTxt) {
    			return inTxt;
    		}

    		return getParentTitle(tocItem);
    	}

    	function hiliHTML(idx) {
    		const r = results[idx];

    		// console.log("hili: idx:", idx, "r:", r);
    		return hilightSearchResult(r.term, r.match);
    	}

    	function navigateToSearchResult(idx) {
    		// console.log("navigateToSearchResult:", idx);
    		var loc = window.location.pathname;

    		var parts = loc.split("/");
    		var lastIdx = parts.length - 1;
    		var lastURL = parts[lastIdx];
    		var selected = results[idx];
    		var tocItem = selected.tocItem;

    		// either replace chapter/article url or append to book url
    		var uri = item.url(tocItem);

    		if (isChapterOrArticleURL(lastURL)) {
    			parts[lastIdx] = uri;
    		} else {
    			parts.push(uri);
    		}

    		loc = parts.join("/");
    		window.location = loc;
    		ondismiss();
    	}

    	function dir(ev) {
    		if (isNavUp(ev)) {
    			return -1;
    		}

    		if (isNavDown(ev)) {
    			return 1;
    		}

    		return 0;
    	}

    	function keyDown(ev) {
    		// console.log("SearchResults.keyDown:", ev);
    		if (isEnter(ev)) {
    			navigateToSearchResult(selectedIdx);
    			ev.stopPropagation();
    			return;
    		}

    		const n = dir(ev);

    		if (n === 0) {
    			return;
    		}

    		ev.stopPropagation();
    		ev.preventDefault();
    		$$invalidate(0, selectedIdx += n);

    		if (selectedIdx < 0) {
    			$$invalidate(0, selectedIdx = 0);
    		}

    		const lastIdx = results.length - 1;

    		if (selectedIdx > lastIdx) {
    			$$invalidate(0, selectedIdx = lastIdx);
    		}

    		// console.log("newSelected", selectedIdx);
    		// changing selected element triggers mouseenter
    		// on the element so we have to supress it
    		ignoreNextMouseEnter = true;
    	}

    	function clicked(idx) {
    		// console.log("clicked:", idx);
    		navigateToSearchResult(idx);
    	}

    	function mouseEnter(idx) {
    		if (ignoreNextMouseEnter) {
    			ignoreNextMouseEnter = false;
    			return;
    		}

    		$$invalidate(0, selectedIdx = idx);
    	}

    	const writable_props = ["ondismiss", "results", "selectedIdx", "searchTerm"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<SearchResults> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("SearchResults", $$slots, []);
    	const click_handler = idx => clicked(idx);
    	const click_handler_1 = idx => clicked(idx);
    	const mouseenter_handler = idx => mouseEnter(idx);

    	$$self.$set = $$props => {
    		if ("ondismiss" in $$props) $$invalidate(1, ondismiss = $$props.ondismiss);
    		if ("results" in $$props) $$invalidate(2, results = $$props.results);
    		if ("selectedIdx" in $$props) $$invalidate(0, selectedIdx = $$props.selectedIdx);
    		if ("searchTerm" in $$props) $$invalidate(3, searchTerm = $$props.searchTerm);
    	};

    	$$self.$capture_state = () => ({
    		Overlay,
    		afterUpdate,
    		beforeUpdate,
    		onMount,
    		onDestroy,
    		isEnter,
    		isNavUp,
    		isNavDown,
    		item,
    		scrollintoview,
    		ondismiss,
    		results,
    		selectedIdx,
    		searchTerm,
    		ignoreNextMouseEnter,
    		prevResulutsCount,
    		getParentTitle,
    		isMatchSynonym,
    		getArticlePath,
    		getWhere,
    		hilightSearchResult,
    		hiliHTML,
    		isChapterOrArticleURL,
    		navigateToSearchResult,
    		dir,
    		keyDown,
    		clicked,
    		mouseEnter
    	});

    	$$self.$inject_state = $$props => {
    		if ("ondismiss" in $$props) $$invalidate(1, ondismiss = $$props.ondismiss);
    		if ("results" in $$props) $$invalidate(2, results = $$props.results);
    		if ("selectedIdx" in $$props) $$invalidate(0, selectedIdx = $$props.selectedIdx);
    		if ("searchTerm" in $$props) $$invalidate(3, searchTerm = $$props.searchTerm);
    		if ("ignoreNextMouseEnter" in $$props) ignoreNextMouseEnter = $$props.ignoreNextMouseEnter;
    		if ("prevResulutsCount" in $$props) prevResulutsCount = $$props.prevResulutsCount;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		selectedIdx,
    		ondismiss,
    		results,
    		searchTerm,
    		getWhere,
    		hiliHTML,
    		clicked,
    		mouseEnter,
    		click_handler,
    		click_handler_1,
    		mouseenter_handler
    	];
    }

    class SearchResults extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {
    			ondismiss: 1,
    			results: 2,
    			selectedIdx: 0,
    			searchTerm: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "SearchResults",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get ondismiss() {
    		throw new Error_1$1("<SearchResults>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set ondismiss(value) {
    		throw new Error_1$1("<SearchResults>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get results() {
    		throw new Error_1$1("<SearchResults>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set results(value) {
    		throw new Error_1$1("<SearchResults>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get selectedIdx() {
    		throw new Error_1$1("<SearchResults>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selectedIdx(value) {
    		throw new Error_1$1("<SearchResults>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get searchTerm() {
    		throw new Error_1$1("<SearchResults>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set searchTerm(value) {
    		throw new Error_1$1("<SearchResults>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* fe\SearchInput.svelte generated by Svelte v3.24.0 */
    const file$3 = "fe\\SearchInput.svelte";

    // (109:0) {#if showResults}
    function create_if_block$2(ctx) {
    	let searchresults;
    	let current;

    	searchresults = new SearchResults({
    			props: {
    				ondismiss: /*ondismiss*/ ctx[5],
    				searchTerm: /*searchTerm*/ ctx[1],
    				results: /*results*/ ctx[3],
    				selectedIdx: 0
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(searchresults.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(searchresults, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const searchresults_changes = {};
    			if (dirty & /*searchTerm*/ 2) searchresults_changes.searchTerm = /*searchTerm*/ ctx[1];
    			if (dirty & /*results*/ 8) searchresults_changes.results = /*results*/ ctx[3];
    			searchresults.$set(searchresults_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(searchresults.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(searchresults.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(searchresults, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(109:0) {#if showResults}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let input_1;
    	let input_1_placeholder_value;
    	let t;
    	let if_block_anchor;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*showResults*/ ctx[4] && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			input_1 = element("input");
    			t = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr_dev(input_1, "placeholder", input_1_placeholder_value = "Search '" + /*bookTitle*/ ctx[0] + "' Tip: press '/'.");
    			attr_dev(input_1, "class", "svelte-hj7awy");
    			add_location(input_1, file$3, 103, 0, 2171);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input_1, anchor);
    			set_input_value(input_1, /*searchTerm*/ ctx[1]);
    			/*input_1_binding*/ ctx[7](input_1);
    			insert_dev(target, t, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(input_1, "input", /*input_1_input_handler*/ ctx[6]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*bookTitle*/ 1 && input_1_placeholder_value !== (input_1_placeholder_value = "Search '" + /*bookTitle*/ ctx[0] + "' Tip: press '/'.")) {
    				attr_dev(input_1, "placeholder", input_1_placeholder_value);
    			}

    			if (dirty & /*searchTerm*/ 2 && input_1.value !== /*searchTerm*/ ctx[1]) {
    				set_input_value(input_1, /*searchTerm*/ ctx[1]);
    			}

    			if (/*showResults*/ ctx[4]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*showResults*/ 16) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input_1);
    			/*input_1_binding*/ ctx[7](null);
    			if (detaching) detach_dev(t);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { bookTitle = "" } = $$props;
    	let searchTerm = "";
    	let input;
    	let results = [];
    	let showResults = false;

    	// Maybe: use debouncer from https://gist.github.com/nmsdvid/8807205
    	const debouncer = makeDebouncer(250);

    	function keyDown(ev) {
    		if (ev.key == "/") {
    			input.focus();
    			ev.preventDefault();
    			return;
    		}

    		if (isEsc(ev)) {
    			$$invalidate(1, searchTerm = "");
    			input.blur();
    			$$invalidate(3, results = []);
    			return;
    		}
    	}

    	function searchTermChanged(s) {
    		const fn = doSearch.bind(this, s);
    		debouncer(fn);
    	}

    	onMount(() => {
    		document.addEventListener("keydown", keyDown);
    	});

    	onDestroy(() => {
    		document.removeEventListener("keydown", keyDown);
    	});

    	function doSearch(s) {
    		s = s.trim().toLowerCase();

    		if (s.length == 0) {
    			$$invalidate(3, results = []);
    			return;
    		}

    		// console.log(`doSearch: '${s}'`);
    		const res = search(s);

    		$$invalidate(3, results = res);
    	} // console.log("results:", results);

    	function ondismiss() {
    		// console.log("didDismiss");
    		$$invalidate(1, searchTerm = "");

    		$$invalidate(3, results = []);
    	}

    	const writable_props = ["bookTitle"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<SearchInput> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("SearchInput", $$slots, []);

    	function input_1_input_handler() {
    		searchTerm = this.value;
    		$$invalidate(1, searchTerm);
    	}

    	function input_1_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			input = $$value;
    			$$invalidate(2, input);
    		});
    	}

    	$$self.$set = $$props => {
    		if ("bookTitle" in $$props) $$invalidate(0, bookTitle = $$props.bookTitle);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		onDestroy,
    		search,
    		makeDebouncer,
    		SearchResults,
    		isEsc,
    		bookTitle,
    		searchTerm,
    		input,
    		results,
    		showResults,
    		debouncer,
    		keyDown,
    		searchTermChanged,
    		doSearch,
    		ondismiss
    	});

    	$$self.$inject_state = $$props => {
    		if ("bookTitle" in $$props) $$invalidate(0, bookTitle = $$props.bookTitle);
    		if ("searchTerm" in $$props) $$invalidate(1, searchTerm = $$props.searchTerm);
    		if ("input" in $$props) $$invalidate(2, input = $$props.input);
    		if ("results" in $$props) $$invalidate(3, results = $$props.results);
    		if ("showResults" in $$props) $$invalidate(4, showResults = $$props.showResults);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*searchTerm*/ 2) {
    			 searchTermChanged(searchTerm);
    		}

    		if ($$self.$$.dirty & /*searchTerm*/ 2) {
    			 $$invalidate(4, showResults = searchTerm !== "");
    		}
    	};

    	return [
    		bookTitle,
    		searchTerm,
    		input,
    		results,
    		showResults,
    		ondismiss,
    		input_1_input_handler,
    		input_1_binding
    	];
    }

    class SearchInput extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { bookTitle: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "SearchInput",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get bookTitle() {
    		throw new Error("<SearchInput>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set bookTitle(value) {
    		throw new Error("<SearchInput>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* fe\PageToc.svelte generated by Svelte v3.24.0 */
    const file$4 = "fe\\PageToc.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	return child_ctx;
    }

    // (64:6) {:else}
    function create_else_block$2(ctx) {
    	let a;
    	let t_value = /*item*/ ctx[5].title + "";
    	let t;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			t = text(t_value);
    			attr_dev(a, "href", a_href_value = /*item*/ ctx[5].url);
    			add_location(a, file$4, 64, 8, 1431);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*tocItems*/ 1 && t_value !== (t_value = /*item*/ ctx[5].title + "")) set_data_dev(t, t_value);

    			if (dirty & /*tocItems*/ 1 && a_href_value !== (a_href_value = /*item*/ ctx[5].url)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$2.name,
    		type: "else",
    		source: "(64:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (62:6) {#if item.isSelected}
    function create_if_block$3(ctx) {
    	let b;
    	let t_value = /*item*/ ctx[5].title + "";
    	let t;

    	const block = {
    		c: function create() {
    			b = element("b");
    			t = text(t_value);
    			add_location(b, file$4, 62, 8, 1389);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, b, anchor);
    			append_dev(b, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*tocItems*/ 1 && t_value !== (t_value = /*item*/ ctx[5].title + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(b);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(62:6) {#if item.isSelected}",
    		ctx
    	});

    	return block;
    }

    // (60:2) {#each tocItems as item}
    function create_each_block$2(ctx) {
    	let div;
    	let t;
    	let div_class_value;

    	function select_block_type(ctx, dirty) {
    		if (/*item*/ ctx[5].isSelected) return create_if_block$3;
    		return create_else_block$2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			t = space();
    			attr_dev(div, "class", div_class_value = "mtoc-" + /*item*/ ctx[5].indent + " svelte-1t851gm");
    			add_location(div, file$4, 60, 4, 1320);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_block.m(div, null);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, t);
    				}
    			}

    			if (dirty & /*tocItems*/ 1 && div_class_value !== (div_class_value = "mtoc-" + /*item*/ ctx[5].indent + " svelte-1t851gm")) {
    				attr_dev(div, "class", div_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(60:2) {#each tocItems as item}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let div;
    	let each_value = /*tocItems*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div, "class", "chapter-toc svelte-1t851gm");
    			add_location(div, file$4, 58, 0, 1263);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*tocItems*/ 1) {
    				each_value = /*tocItems*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let tocItems = [];
    	const pageURL = getLocationLastElement();

    	function makeItem(it, indent) {
    		const url = item.url(it);
    		const isSelected = url == pageURL;

    		return {
    			title: item.title(it),
    			url,
    			indent,
    			isSelected
    		};
    	}

    	function getChildrenForIdx(idx) {
    		const it = gTocItems[idx];
    		const allChildren = item.childrenForParentIdx(idx);
    		const res = [makeItem(it, 0)];
    		res[0].title = res[0].title + "/";

    		for (let idx of allChildren) {
    			const c = gTocItems[idx];
    			const uri = item.url(c);

    			if (!uri.includes("#")) {
    				res.push(makeItem(c, 1));
    			}
    		}

    		return res;
    	}

    	function calcTocItems() {
    		let idx = findTocIdxForCurrentURL();
    		const it = gTocItems[idx];
    		$$invalidate(0, tocItems = getChildrenForIdx(idx));

    		if (tocItems.length === 1) {
    			idx = item.parentIdx(gTocItems[idx]);

    			if (idx != -1) {
    				$$invalidate(0, tocItems = getChildrenForIdx(idx));
    			}
    		}

    		if (tocItems.length === 1) {
    			$$invalidate(0, tocItems = []);
    		}
    	}

    	calcTocItems();
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<PageToc> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("PageToc", $$slots, []);

    	$$self.$capture_state = () => ({
    		findTocIdxForCurrentURL,
    		getLocationLastElement,
    		item,
    		tocItems,
    		pageURL,
    		makeItem,
    		getChildrenForIdx,
    		calcTocItems
    	});

    	$$self.$inject_state = $$props => {
    		if ("tocItems" in $$props) $$invalidate(0, tocItems = $$props.tocItems);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [tocItems];
    }

    class PageToc extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PageToc",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* fe\BookToc.svelte generated by Svelte v3.24.0 */
    const file$5 = "fe\\BookToc.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    // (99:6) {:else}
    function create_else_block$3(ctx) {
    	let a;
    	let t_value = /*item*/ ctx[6].title + "";
    	let t;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			t = text(t_value);
    			attr_dev(a, "href", a_href_value = /*item*/ ctx[6].url);
    			add_location(a, file$5, 99, 8, 1796);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*tocItems*/ 1 && t_value !== (t_value = /*item*/ ctx[6].title + "")) set_data_dev(t, t_value);

    			if (dirty & /*tocItems*/ 1 && a_href_value !== (a_href_value = /*item*/ ctx[6].url)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$3.name,
    		type: "else",
    		source: "(99:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (97:6) {#if item.isSelected}
    function create_if_block$4(ctx) {
    	let span;
    	let t_value = /*item*/ ctx[6].title + "";
    	let t;

    	const block = {
    		c: function create() {
    			span = element("span");
    			t = text(t_value);
    			attr_dev(span, "class", "current svelte-1ib47n1");
    			add_location(span, file$5, 97, 8, 1732);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*tocItems*/ 1 && t_value !== (t_value = /*item*/ ctx[6].title + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(97:6) {#if item.isSelected}",
    		ctx
    	});

    	return block;
    }

    // (94:2) {#each tocItems as item}
    function create_each_block$3(ctx) {
    	let div;
    	let span;
    	let t0_value = /*item*/ ctx[6].no + "";
    	let t0;
    	let t1;
    	let t2;

    	function select_block_type(ctx, dirty) {
    		if (/*item*/ ctx[6].isSelected) return create_if_block$4;
    		return create_else_block$3;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			span = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			if_block.c();
    			t2 = space();
    			attr_dev(span, "class", "no svelte-1ib47n1");
    			add_location(span, file$5, 95, 6, 1662);
    			attr_dev(div, "class", "chapters-toc-item");
    			add_location(div, file$5, 94, 4, 1624);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, span);
    			append_dev(span, t0);
    			append_dev(div, t1);
    			if_block.m(div, null);
    			append_dev(div, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*tocItems*/ 1 && t0_value !== (t0_value = /*item*/ ctx[6].no + "")) set_data_dev(t0, t0_value);

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, t2);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(94:2) {#each tocItems as item}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let div;
    	let each_value = /*tocItems*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div, "class", "toc svelte-1ib47n1");
    			add_location(div, file$5, 92, 0, 1575);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*tocItems*/ 1) {
    				each_value = /*tocItems*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$3(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let tocItems = [];
    	let no = 0;
    	const pageURL = getLocationLastElement();

    	function makeItem(it, indent) {
    		const url = item.url(it);
    		const isSelected = url == pageURL;
    		no++;

    		return {
    			title: item.title(it),
    			url,
    			indent,
    			isSelected,
    			no
    		};
    	}

    	function getChildrenForIdx(idx) {
    		const it = gTocItems[idx];
    		const allChildren = item.childrenForParentIdx(idx);
    		const res = [];

    		for (let idx of allChildren) {
    			const c = gTocItems[idx];
    			const uri = item.url(c);

    			if (!uri.includes("#")) {
    				res.push(makeItem(c, 1));
    			}
    		}

    		return res;
    	}

    	function calcTocItems() {
    		$$invalidate(0, tocItems = getChildrenForIdx(-1));
    	} // console.log("calcTocItems:", tocItems);

    	calcTocItems();
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<BookToc> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("BookToc", $$slots, []);

    	$$self.$capture_state = () => ({
    		getLocationLastElement,
    		item,
    		tocItems,
    		no,
    		pageURL,
    		makeItem,
    		getChildrenForIdx,
    		calcTocItems
    	});

    	$$self.$inject_state = $$props => {
    		if ("tocItems" in $$props) $$invalidate(0, tocItems = $$props.tocItems);
    		if ("no" in $$props) no = $$props.no;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [tocItems];
    }

    class BookToc extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "BookToc",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    // pageId looks like "5ab3b56329c44058b5b24d3f364183ce"
    // find full url of the page matching this pageId
    function findURLWithPageId(pageId) {
      var n = gTocItems.length;
      for (var i = 0; i < n; i++) {
        var tocItem = gTocItems[i];
        var uri = item.url(tocItem);
        // uri looks like "go-get-5ab3b56329c44058b5b24d3f364183ce"
        if (uri.endsWith(pageId)) {
          return uri;
        }
      }
      return "";
    }

    function do404() {
      var loc = window.location.pathname;
      var locParts = loc.split("/");
      var lastIdx = locParts.length - 1;
      var uri = locParts[lastIdx];
      // redirect ${garbage}-${id} => ${correct url}-${id}
      var parts = uri.split("-");
      var pageId = parts[parts.length - 1];
      var fullURL = findURLWithPageId(pageId);
      if (fullURL != "") {
        locParts[lastIdx] = fullURL;
        var loc = locParts.join("/");
        window.location.pathname = loc;
      }
    }
    window.do404 = do404;

    function httpsMaybeRedirect() {
      if (window.location.protocol !== "http:") {
        return;
      }
      if (window.location.hostname !== "www.programming-books.io") {
        return;
      }
      var uri = window.location.toString();
      uri = uri.replace("http://", "https://");
      window.location = uri;
    }

    window.httpsMaybeRedirect = httpsMaybeRedirect;

    function showContact() {
      var el = document.getElementById("contact-form");
      el.style.display = "block";
      el = document.getElementById("contact-page-url");
      var uri = window.location.href;
      //uri = uri.replace("#", "");
      el.value = uri;
      el = document.getElementById("msg-for-chris");
      el.focus();
    }

    function hideContact() {
      var el = document.getElementById("contact-form");
      el.style.display = "none";
    }

    window.showContact = showContact;
    window.hideContact = hideContact;

    // rv = rememberView but short because it's part of url
    function rv(view) {
      //console.log("rv:", view);
      viewSet(view);
    }
    window.rv = rv;

    const app = {
      toc: Toc,
      searchInput: SearchInput,
      pageToc: PageToc,
      bookToc: BookToc,
    };

    function updateLinkHome() {
      var view = viewGet();
      if (!view) {
        return;
      }
      var uri = "/";
      if (view === "list") ; else if (view == "grid") {
        uri = "/index-grid";
      } else {
        console.log("unknown view:", view);
        viewClear();
      }
      var el = document.getElementById("link-home");
      if (el && el.href) {
        //console.log("update home url to:", uri);
        el.href = uri;
      }
    }

    function doIndexPage() {
      var view = viewGet();
      var loc = window.location.pathname;
      //console.log("doIndexPage(): view:", view, "loc:", loc);
      if (!view) {
        return;
      }
      if (view === "list") {
        if (loc === "/index-grid") {
          window.location = "/";
        }
      } else if (view === "grid") {
        if (loc === "/") {
          window.location = "/index-grid";
        }
      } else {
        console.log("Unknown view:", view);
      }
    }

    // we don't want to run javascript on about etc. pages
    var loc = window.location.pathname;
    var isIndexPage = loc === "/" || loc === "/index-grid";

    if (isIndexPage) {
      doIndexPage();
      updateLinkHome();
    }

    return app;

}());
//# sourceMappingURL=bundle.js.map
