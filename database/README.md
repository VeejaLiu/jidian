# SQLite 数据库设计

数据库文件建议放在：

```text
data/fund-dca.sqlite
```

初始化结构：

```bash
mkdir -p data
sqlite3 data/fund-dca.sqlite < database/schema.sql
```

现在项目里的 Node 服务会在启动时自动初始化数据库，并在同一个端口托管前端页面和 API。开发或日常使用运行：

```bash
npm run dev
```

然后打开：

```text
http://127.0.0.1:4173/
```

正式运行也是单服务：

```bash
npm start
```

## 核心表

`funds`：基金主表，保存基金名称、代码、币种、是否启用。它同时承担本地基金资料库的角色；从界面移除基金时只会把 `is_active` 设为 `0`，不会删除基金资料和历史净值。

`strategy_settings`：每只基金的策略参数。现在默认是 `drop_rate = 0.04`，也就是下跌 4% 买入一份。

`nav_history`：历史净值表。每只基金每天只保留一条单位净值，重复同步同一天时会更新同一条记录。它是可复用的净值库，后续再次添加同一基金时会直接复用已有净值。

`buy_records`：买入记录表。每次买入都单独保存。前端只需要填写买入日期和买入金额，程序会从 `nav_history` 中读取该日期单位净值，自动计算份额并保存；日期最新的一条买入记录会作为下一次 4% 触发基准。

数据库版本放在 SQLite 的 `user_version` 里，目前是 `1`。以后如果结构升级，可以用它判断是否需要迁移。

## 触发计算

下一触发净值：

```text
last_buy_nav * (1 - drop_rate)
```

今日需达到跌幅：

```text
(1 - trigger_nav / latest_nav) * 100
```

其中 `latest_nav` 是最新一条净值记录。实际使用时，你可以每天把“昨日净值”录入 `nav_history`，程序就能计算今天需要下跌多少才触发买入。

## 直接查询结果

```sql
SELECT
  code,
  name,
  last_buy_nav,
  latest_nav,
  trigger_nav,
  required_drop_percent,
  status
FROM fund_trigger_status
ORDER BY name;
```

`status` 的含义：

- `missing_buy`：还没有买入记录
- `missing_nav`：还没有净值记录
- `waiting`：尚未触发，查看 `required_drop_percent`
- `triggered`：已经达到或低于触发净值
