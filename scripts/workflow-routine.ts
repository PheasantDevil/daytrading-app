import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../src/utils/logger';

const execAsync = promisify(exec);
const logger = new Logger('WorkflowRoutine');

interface WorkflowOptions {
  branchName: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
}

async function runCommand(command: string, description: string): Promise<void> {
  try {
    logger.info(`🔄 ${description}...`);
    const { stdout, stderr } = await execAsync(command);
    
    if (stdout) {
      logger.info(`✅ ${description}が完了しました`);
      if (stdout.trim()) {
        logger.info(`出力: ${stdout.trim()}`);
      }
    }
    
    if (stderr) {
      logger.warn(`警告: ${stderr.trim()}`);
    }
  } catch (error) {
    logger.error(`❌ ${description}に失敗しました:`, error);
    throw error;
  }
}

async function workflowRoutine(options: WorkflowOptions): Promise<void> {
  const { branchName, commitMessage, prTitle, prBody } = options;
  
  logger.info('🚀 ワークフロールーティンを開始します...');
  logger.info(`ブランチ名: ${branchName}`);
  logger.info(`コミットメッセージ: ${commitMessage}`);

  try {
    // Step 1: 最新のmainブランチから作業ブランチをcheckout
    logger.info('📋 Step 1: 最新のmainブランチから作業ブランチをcheckout');
    
    // 現在のブランチを確認
    await runCommand('git branch --show-current', '現在のブランチ確認');
    
    // mainブランチに切り替え
    await runCommand('git checkout main', 'mainブランチに切り替え');
    
    // 最新の変更を取得
    await runCommand('git pull origin main', '最新の変更を取得');
    
    // 作業ブランチを作成・切り替え
    await runCommand(`git checkout -b ${branchName}`, '作業ブランチを作成・切り替え');
    
    logger.info('✅ Step 1が完了しました');

    // Step 2: 変更をコミット
    logger.info('📋 Step 2: 変更をコミット');
    
    // 変更をステージング
    await runCommand('git add .', '変更をステージング');
    
    // コミット
    await runCommand(`git commit -m "${commitMessage}"`, '変更をコミット');
    
    logger.info('✅ Step 2が完了しました');

    // Step 3: ブランチをプッシュ
    logger.info('📋 Step 3: ブランチをプッシュ');
    
    await runCommand(`git push origin ${branchName}`, 'ブランチをプッシュ');
    
    logger.info('✅ Step 3が完了しました');

    // Step 4: PRを作成
    logger.info('📋 Step 4: PRを作成');
    
    const prCommand = `gh pr create --title "${prTitle}" --body "${prBody}" --base main`;
    await runCommand(prCommand, 'PRを作成');
    
    logger.info('✅ Step 4が完了しました');

    // Step 5: PRをマージ
    logger.info('📋 Step 5: PRをマージ');
    
    // PRの番号を取得
    const { stdout: prNumber } = await execAsync(`gh pr list --head ${branchName} --json number --jq '.[0].number'`);
    const prNum = prNumber.trim();
    
    if (prNum && prNum !== 'null') {
      await runCommand(`gh pr merge ${prNum} --merge --delete-branch`, 'PRをマージ');
      logger.info('✅ Step 5が完了しました');
    } else {
      logger.warn('⚠️ PR番号を取得できませんでした。手動でマージしてください');
    }

    // Step 6: ローカルのmainブランチを更新
    logger.info('📋 Step 6: ローカルのmainブランチを更新');
    
    await runCommand('git checkout main', 'mainブランチに切り替え');
    await runCommand('git pull origin main', '最新の変更を取得');
    
    logger.info('✅ Step 6が完了しました');

    logger.info('🎉 ワークフロールーティンが完了しました');
    logger.info('📊 実行結果:');
    logger.info(`- ブランチ: ${branchName}`);
    logger.info(`- コミット: ${commitMessage}`);
    logger.info(`- PR: ${prTitle}`);
    logger.info('- マージ: 完了');

  } catch (error) {
    logger.error('❌ ワークフロールーティンに失敗しました:', error);
    process.exit(1);
  }
}

// デフォルトのワークフローオプション
const defaultOptions: WorkflowOptions = {
  branchName: 'feature/sbi-securities-setup',
  commitMessage: 'SBI証券API設定とワークフロールーティンの実装\n\n- SBI証券API設定ガイドの作成\n- SBI証券専用設定ファイルの実装\n- SBI証券接続テストスクリプトの作成\n- ワークフロールーティンの自動化\n- 手動設定手順の詳細化\n\nSBI証券に特化した自動売買システムの設定が完了しました。',
  prTitle: 'SBI証券API設定とワークフロールーティンの実装',
  prBody: `## SBI証券API設定の実装

### 実装内容
- **SBI証券API設定ガイド**: 詳細な手動設定手順
- **SBI証券専用設定**: 環境変数と設定ファイル
- **接続テストスクリプト**: API接続の自動テスト
- **ワークフロールーティン**: 自動化されたGitワークフロー

### 手動設定手順
1. SBI証券APIの申込
2. アプリケーション登録
3. アクセストークン取得
4. 環境変数の設定
5. 接続テストの実行

### ワークフロー自動化
- 最新のmainブランチから作業ブランチをcheckout
- 変更のコミット・プッシュ
- PRの自動作成・マージ
- ローカルブランチの更新

### 次のステップ
1. SBI証券APIの手動設定
2. 環境変数の設定
3. 接続テストの実行
4. 自動売買システムの本格運用

SBI証券に特化した自動売買システムが利用可能になりました！`,
};

// スクリプト実行
const args = process.argv.slice(2);

if (args.length === 0) {
  // デフォルトオプションで実行
  workflowRoutine(defaultOptions).catch(console.error);
} else if (args.length >= 4) {
  // カスタムオプションで実行
  const customOptions: WorkflowOptions = {
    branchName: args[0],
    commitMessage: args[1],
    prTitle: args[2],
    prBody: args[3],
  };
  workflowRoutine(customOptions).catch(console.error);
} else {
  logger.error('❌ 引数が不足しています');
  logger.info('使用方法:');
  logger.info('  npm run workflow  # デフォルトオプションで実行');
  logger.info('  npm run workflow <branchName> <commitMessage> <prTitle> <prBody>  # カスタムオプションで実行');
  process.exit(1);
}

export { workflowRoutine, WorkflowOptions };
