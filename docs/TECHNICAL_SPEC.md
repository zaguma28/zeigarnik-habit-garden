# 技術仕様書

## 1. システムアーキテクチャ

### 1.1 全体構成

```
[React Native App]
    ↓
[Zustand Store] ← [Firebase Services]
    ↓                   ↓
[Local Storage]   [Cloud Database]
    ↓
[AdMob SDK]
```

### 1.2 データフロー

1. ユーザーがタスクを完了
2. Zustand Storeが状態を更新
3. Firebase Realtime DBに同期
4. リワード計算（経験値、コイン）
5. 育成要素の更新
6. 広告表示判定

## 2. データモデル

### 2.1 User

```typescript
interface User {
  id: string;
  username: string;
  email: string;
  level: number;
  experience: number;
  coins: number;
  createdAt: timestamp;
  lastLoginAt: timestamp;
  consecutiveLoginDays: number;
  unlockedFeatures: string[]; // ['pet', 'garden', 'city', 'aquarium', 'space']
}
```

### 2.2 Task

```typescript
interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  type: 'one-time' | 'daily' | 'weekly';
  priority: 'low' | 'medium' | 'high';
  status: 'active' | 'completed' | 'archived';
  progress: number; // 0-100
  reward: {
    exp: number;
    coins: number;
  };
  createdAt: timestamp;
  completedAt?: timestamp;
  deadline?: timestamp;
  reminderTime?: timestamp;
}
```

### 2.3 Pet

```typescript
interface Pet {
  id: string;
  userId: string;
  name: string;
  type: string; // 'cat', 'dog', 'dragon', etc.
  level: number;
  experience: number;
  happiness: number; // 0-100
  hunger: number; // 0-100
  lastFedAt: timestamp;
  appearance: {
    color: string;
    accessories: string[];
  };
}
```

### 2.4 Garden

```typescript
interface Garden {
  id: string;
  userId: string;
  level: number;
  plants: Plant[];
  decorations: Decoration[];
  size: number; // Available slots
}

interface Plant {
  id: string;
  type: string;
  growthStage: number; // 0-5
  plantedAt: timestamp;
  position: { x: number; y: number };
}

interface Decoration {
  id: string;
  type: string;
  position: { x: number; y: number };
}
```

### 2.5 City (Level 10+)

```typescript
interface City {
  id: string;
  userId: string;
  level: number;
  buildings: Building[];
  population: number;
  happiness: number;
}

interface Building {
  id: string;
  type: string; // 'house', 'shop', 'park', etc.
  level: number;
  position: { x: number; y: number };
  constructedAt: timestamp;
}
```

### 2.6 Aquarium (Level 20+)

```typescript
interface Aquarium {
  id: string;
  userId: string;
  level: number;
  tankSize: number;
  fish: Fish[];
  decorations: AquaDecoration[];
  waterQuality: number; // 0-100
}

interface Fish {
  id: string;
  species: string;
  size: number;
  health: number;
  addedAt: timestamp;
}
```

### 2.7 SpaceStation (Level 30+)

```typescript
interface SpaceStation {
  id: string;
  userId: string;
  level: number;
  modules: SpaceModule[];
  resources: {
    energy: number;
    oxygen: number;
    metal: number;
  };
  crew: number;
}

interface SpaceModule {
  id: string;
  type: string; // 'habitat', 'laboratory', 'solar-panel', etc.
  level: number;
  status: 'active' | 'inactive' | 'damaged';
}
```

## 3. コア機能実装

### 3.1 ツァイガルニク効果の実装

#### 視覚的手法
```typescript
// 未完了タスクの強調表示
const TaskCard = ({ task }) => {
  const progressColor = task.progress > 80 ? 'orange' : 'blue';
  const shouldPulse = task.progress > 80;
  
  return (
    <View style={[styles.card, shouldPulse && styles.pulse]}>
      <ProgressBar 
        progress={task.progress} 
        color={progressColor}
      />
      {task.progress > 80 && (
        <Badge>あと少し！</Badge>
      )}
    </View>
  );
};
```

#### 通知戦略
- 進捗80%以上のタスク: 「もう少しで完了です！」
- 1日未着手のタスク: 「タスクが待っています」
- 連続達成中: 「記録を伸ばしましょう」

### 3.2 プロスペクト理論の実装

#### 損失回避の設計
```typescript
// 連続ログインボーナス
const LoginBonusSystem = {
  calculateBonus: (consecutiveDays: number) => {
    return Math.min(consecutiveDays * 10, 300); // 最大300コイン
  },
  
  showLossPreview: (consecutiveDays: number) => {
    // 「ログインしないと○○コインを失います」表示
    const potentialLoss = calculateBonus(consecutiveDays + 1);
    return `ログインしないと${potentialLoss}コインのチャンスを逃します`;
  }
};

// ペットの空腹システム
const HungerSystem = {
  decreaseRate: 1, // 1時間あたり1減少  
  
  getHungerStatus: (hunger: number) => {
    if (hunger < 20) return { status: 'starving', message: 'お腹がペコペコです...' };
    if (hunger < 50) return { status: 'hungry', message: 'そろそろご飯が欲しいな' };
    return { status: 'satisfied', message: '満足しています！' };
  }
};
```

#### 獲得報酬の設計
```typescript
const RewardSystem = {
  calculateTaskReward: (task: Task) => {
    const baseReward = {
      exp: 10,
      coins: 5
    };
    
    // 優先度による倍率
    const priorityMultiplier = {
      low: 1,
      medium: 1.5,
      high: 2
    };  
    
    // 連続達成ボーナス
    const streakBonus = 1 + (task.streak * 0.1);
    
    return {
      exp: baseReward.exp * priorityMultiplier[task.priority] * streakBonus,
      coins: baseReward.coins * priorityMultiplier[task.priority] * streakBonus
    };
  }
};
```

## 4. 広告統合戦略

### 4.1 AdMob実装

```typescript
import { 
  RewardedAd, 
  BannerAd, 
  InterstitialAd,
  RewardedAdEventType 
} from 'react-native-google-mobile-ads';

// リワード広告
const RewardedAdService = {
  ad: RewardedAd.createForAdRequest('ca-app-pub-xxxxx'),
  
  show: async (rewardType: 'double-coins' | 'instant-growth') => {
    const loaded = await this.ad.load();
    if (loaded) {
      this.ad.show();
    }
  },
  
  onReward: (reward: Reward) => {
    // 報酬を2倍にする、即座に成長させるなど
  }
};
```

### 4.2 広告配置戦略

| 広告タイプ | 配置場所 | 表示タイミング | 収益期待値 |
|----------|---------|--------------|----------|
| バナー | ホーム画面下部 | 常時 | 低 |
| インタースティシャル | タスク完了時 | 3タスクごと | 中 |
| リワード | 報酬2倍オファー | ユーザー選択 | 高 |
| リワード | 育成加速 | ユーザー選択 | 高 |

### 4.3 ユーザー体験最適化

```typescript
const AdStrategy = {
  // 広告表示の判定
  shouldShowInterstitial: (taskCompletedCount: number) => {
    // 3タスクごとに表示
    return taskCompletedCount % 3 === 0 && taskCompletedCount > 0;
  },
  
  // 広告表示間隔の制御
  canShowAd: (lastAdShownAt: timestamp) => {
    const MIN_INTERVAL = 3 * 60 * 1000; // 3分
    return Date.now() - lastAdShownAt > MIN_INTERVAL;
  },
  
  // リワード広告のオファー
  offerRewardedAd: (context: string) => {
    const offers = {
      'task-complete': '広告を見て報酬を2倍にする',
      'pet-hungry': '広告を見て即座に満腹にする',
      'plant-growth': '広告を見て即座に成長させる'
    };
    return offers[context];
  }
};
```

## 5. レベルアンロックシステム

```typescript
const UnlockSystem = {
  features: {
    pet: { level: 0, name: 'ペット' },
    garden: { level: 0, name: '庭園' },
    city: { level: 10, name: '街・王国' },
    aquarium: { level: 20, name: '水族館' },
    space: { level: 30, name: '宇宙ステーション' }
  },
  
  checkUnlock: (userLevel: number, currentUnlocked: string[]) => {
    const newUnlocks: string[] = [];
    
    Object.entries(this.features).forEach(([key, feature]) => {
      if (userLevel >= feature.level && !currentUnlocked.includes(key)) {
        newUnlocks.push(key);
      }
    });
    
    return newUnlocks;
  },
  
  getNextUnlock: (userLevel: number) => {
    const nextFeature = Object.entries(this.features)
      .find(([_, feature]) => feature.level > userLevel);
    
    if (nextFeature) {
      const [key, feature] = nextFeature;
      return {
        feature: feature.name,
        level: feature.level,
        remaining: feature.level - userLevel
      };
    }
    
    return null;
  }
};
```

## 6. パフォーマンス最適化

### 6.1 画像・アニメーション最適化
- Lottieファイルは50KB以下に圧縮
- 画像はWebP形式を使用
- Lazy loading for 育成要素のアセット

### 6.2 データ同期最適化
```typescript
// Debounced Firebase sync
const syncToFirebase = debounce((data) => {
  firebase.database().ref(`users/${userId}`).update(data);
}, 2000);

// Optimistic UI updates
const completeTask = async (taskId: string) => {
  // 即座にUIを更新
  updateLocalState(taskId, { status: 'completed' });
  
  // バックグラウンドで同期
  try {
    await syncToFirebase({ taskId, status: 'completed' });
  } catch (error) {
    // ロールバック
    updateLocalState(taskId, { status: 'active' });
    showError('同期に失敗しました');
  }
};
```

## 7. セキュリティ

### 7.1 Firebase Security Rules

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid",
        "coins": {
          ".validate": "newData.val() >= data.val()"
        }
      }
    }
  }
}
```

### 7.2 不正防止
- タスク完了のタイムスタンプ検証
- 報酬計算はサーバーサイドで実行
- レート制限の実装

## 8. アナリティクス

### 8.1 トラッキングイベント

```typescript
const Analytics = {
  trackTaskComplete: (task: Task) => {
    analytics().logEvent('task_complete', {
      task_type: task.type,
      task_priority: task.priority,
      completion_time: Date.now() - task.createdAt
    });
  },
  
  trackFeatureUnlock: (feature: string, level: number) => {
    analytics().logEvent('feature_unlock', {
      feature_name: feature,
      user_level: level
    });
  },
  
  trackAdRevenue: (adType: string, revenue: number) => {
    analytics().logEvent('ad_impression_revenue', {
      ad_type: adType,
      value: revenue,
      currency: 'USD'
    });
  }
};
```

## 9. テスト戦略

### 9.1 ユニットテスト
- リワード計算ロジック
- レベルアンロックシステム
- ツァイガルニク効果のトリガー条件

### 9.2 統合テスト
- Firebase連携
- 広告SDK統合
- 通知システム

### 9.3 E2Eテスト (Detox)
- ユーザー登録フロー
- タスク作成→完了→報酬獲得
- 育成要素のアンロック

## 10. デプロイメント

### 10.1 環境設定

```typescript
// config/env.ts
export const ENV = {
  development: {
    apiUrl: 'http://localhost:3000',
    firebaseConfig: {...},
    admobIds: {
      banner: 'ca-app-pub-test-banner',
      interstitial: 'ca-app-pub-test-interstitial',
      rewarded: 'ca-app-pub-test-rewarded'
    }
  },
  production: {
    apiUrl: 'https://api.zeigarnik-habit.com',
    firebaseConfig: {...},
    admobIds: {
      banner: 'ca-app-pub-xxxxx-banner',
      interstitial: 'ca-app-pub-xxxxx-interstitial',
      rewarded: 'ca-app-pub-xxxxx-rewarded'
    }
  }
};
```

### 10.2 CI/CDパイプライン

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run tests
        run: npm test

  build-ios:
    needs: test
    runs-on: macos-latest
    steps:
      - name: Build iOS
        run: cd ios && pod install && xcodebuild

  build-android:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build Android
        run: cd android && ./gradlew assembleRelease
```
