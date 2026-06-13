const path = require('path')
const root = path.resolve(__dirname, '../../')

module.exports = {
  plugins: [
    require(path.join(root, 'node_modules/tailwindcss')),
    require(path.join(root, 'node_modules/autoprefixer')),
  ],
}
