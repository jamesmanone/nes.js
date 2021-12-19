const path = require('path');
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  entry: path.resolve(__dirname, './src/index.js'),
  output: {
    path: path.resolve(__dirname, './dist'),
    filename: "bundle.js"
  },
  devServer: {
    port: 7001
  },
  plugins: [
    new HtmlWebpackPlugin({
        title: "gbjs"
    })
  ],
  module: {
    rules: [
      {
        test: /\.(js)$/,
        use: ['babel-loader']
      }
    ]
  },
  resolve: {
    extensions: ['*', '.js']
  }
};