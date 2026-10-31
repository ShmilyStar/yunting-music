const chalk = require('chalk')
const updateVersionFile = require('./utils/updateChangeLog')

// 只负责本地更新版本号 / CHANGELOG / publish/version.json。
// 打包、发版、同步都由 GitHub Actions（release.yml）完成，这里不再处理。
const run = async() => {
  await updateVersionFile(process.argv.slice(2)[0])
  console.log(chalk.green('日志更新完成~'))
}

run()
