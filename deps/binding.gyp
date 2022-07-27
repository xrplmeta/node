{
  'targets': [
    {
      'target_name': 'sqlite-xfl',
      'dependencies': ['../node_modules/better-sqlite3/deps/sqlite3.gyp:sqlite3'],
      'sources': ['sqlite-extensions/xfl.c'],
    }
  ]
}