# cn.js

*"Chuck Norris would never use a Java Script Framework, he would write his own ;-)"*

cn.js is a very smale javascript framework only for educational purpose. This code is onöly for learning javascrip, do *not use* this for a professional application!

Example:

```html
<html>
    <body>
        <div id="my-app">
            <h1>This is cn.js</h1>
            <button cn:click="data.count++">{{ data.count }}</button>
            <span cn:if="data.count % 2 == 0">Count is even</span>
        </div>
        <script type="module">
            import {mount} from './cn.js'
            const app = mount('#my-app', { 'count': 0 })
        </script>
    </body>
</html>
```

The framework is inspired by https://vuejs.org/

## Quickstart

To run the example you have to host the file cn.js and index.html with a simple webserver. 
You can use python for that for example:

    python -m http.server

Than you can open this url: http://localhost:8000
