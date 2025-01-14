module.exports = {
  entry: './src/drawflow.js',
  devtool: 'source-map',
  output: {
    library: 'Drawflow',
    libraryTarget: 'umd',
    libraryExport: 'default',
    filename: 'drawflow.min.js',
    globalObject: `(typeof self !== 'undefined' ? self : this)`
  }
};
