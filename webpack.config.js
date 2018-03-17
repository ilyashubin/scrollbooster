let path = require('path')
let webpack = require('webpack')

module.exports = {
  entry: {
    "scrollbooster": "./src/index.js",
    "scrollbooster.min": "./src/index.js",
  },
  output: {
    path: path.resolve(__dirname, './dist'),
    publicPath: '/dist/',
    filename: '[name].js',
    library: 'ScrollBooster',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/
      }
    ]
  },
  devServer: {
    historyApiFallback: true,
    noInfo: true,
    overlay: true,
    clientLogLevel: "none"
  },
  devtool: '#source-map',
  plugins: [
    new webpack.optimize.UglifyJsPlugin({
      include: /\.min\.js$/,
      minimize: true
    }),
    new webpack.LoaderOptionsPlugin({
      include: /\.min\.js$/,
      minimize: true
    })
  ]
}
