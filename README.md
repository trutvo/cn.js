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
        </div>
        <script type="module">
            import {mount} from './cn.js'
            const app = mount('#my-app', { 'count': 0 })
        </script>
    </body>
</html>
```

The framework was inspired by https://vuejs.org/
