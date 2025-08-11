import { Repository } from 'typeorm';
import { SymbolEntity } from '../entities/symbol.entity';
import { LabelEntity } from '../entities/label.entity';
import { EntityLabelEntity } from '../entities/entity-label.entity';
import { AssetType, EntityType, MarketRegion } from '../../common/shared-types';

export class SymbolRepository {
  constructor(
    private readonly symbolRepository: Repository<SymbolEntity>,
    private readonly labelRepository: Repository<LabelEntity>,
    private readonly entityLabelRepository: Repository<EntityLabelEntity>
  ) {}

  async findAll(): Promise<SymbolEntity[]> {
    return await this.symbolRepository.find();
  }

  async findById(id: string): Promise<SymbolEntity | null> {
    return await this.symbolRepository.findOne({ where: { id } });
  }

  async findByCode(code: string): Promise<SymbolEntity | null> {
    return await this.symbolRepository.findOne({ where: { symbolCode: code } });
  }

  async findByCodeAndRegion(
    code: string,
    region: MarketRegion
  ): Promise<SymbolEntity | null> {
    return await this.symbolRepository.findOne({
      where: {
        symbolCode: code,
        exchangeArea: region,
      },
    });
  }

  async save(symbol: SymbolEntity): Promise<SymbolEntity> {
    return await this.symbolRepository.save(symbol);
  }

  async update(id: string, updateData: Partial<SymbolEntity>): Promise<void> {
    // Remove relations before updating to avoid TypeORM query issues
    const { positions, ...safeUpdateData } = updateData;
    await this.symbolRepository.update(id, safeUpdateData as any);
  }

  async delete(id: string): Promise<void> {
    await this.symbolRepository.delete(id);
  }

  // 暴露 createQueryBuilder 方法供高級查詢使用
  createQueryBuilder(alias?: string) {
    return this.symbolRepository.createQueryBuilder(alias);
  }

  async findByExchangeArea(
    exchangeArea: MarketRegion
  ): Promise<SymbolEntity[]> {
    return await this.symbolRepository.find({ where: { exchangeArea } });
  }

  // ==================== Count Methods ====================

  /**
   * 取得所有 symbol 的總數量
   */
  async countAll(): Promise<number> {
    return await this.symbolRepository.count();
  }

  /**
   * 根據交易區域計算 symbol 數量
   * @param exchangeArea 交易區域 (如 'TPE', 'US', 'HK' 等)
   */
  async countByExchangeArea(exchangeArea: MarketRegion): Promise<number> {
    return await this.symbolRepository.count({ where: { exchangeArea } });
  }

  /**
   * 根據資產類型計算 symbol 數量
   * @param assetType 資產類型
   */
  async countByAssetType(assetType: AssetType): Promise<number> {
    return await this.symbolRepository.count({ where: { assetType } });
  }

  /**
   * 根據交易區域和資產類型計算 symbol 數量
   * @param exchangeArea 交易區域
   * @param assetType 資產類型
   */
  async countByExchangeAreaAndAssetType(
    exchangeArea: MarketRegion,
    assetType: AssetType
  ): Promise<number> {
    return await this.symbolRepository.count({
      where: { exchangeArea, assetType },
    });
  }

  /**
   * 取得各交易區域的 symbol 統計
   */
  async getSymbolStatsByExchangeArea(): Promise<{
    [exchangeArea: string]: number;
  }> {
    const results = await this.symbolRepository
      .createQueryBuilder('symbol')
      .select('symbol.exchangeArea', 'exchangeArea')
      .addSelect('COUNT(*)', 'count')
      .groupBy('symbol.exchangeArea')
      .getRawMany();

    const stats: { [exchangeArea: string]: number } = {};
    results.forEach((result) => {
      stats[result.exchangeArea] = parseInt(result.count, 10);
    });

    return stats;
  }

  /**
   * 取得完整的 symbol 統計資訊
   */
  async getCompleteSymbolStats(): Promise<{
    total: number;
    byExchangeArea: { [exchangeArea: string]: number };
    byAssetType: { [assetType: string]: number };
  }> {
    const [total, exchangeAreaStats, assetTypeStats] = await Promise.all([
      this.countAll(),
      this.getSymbolStatsByExchangeArea(),
      this.getSymbolStatsByAssetType(),
    ]);

    return {
      total,
      byExchangeArea: exchangeAreaStats,
      byAssetType: assetTypeStats,
    };
  }

  /**
   * 取得各資產類型的 symbol 統計
   */
  async getSymbolStatsByAssetType(): Promise<{
    [assetType: string]: number;
  }> {
    const results = await this.symbolRepository
      .createQueryBuilder('symbol')
      .select('symbol.assetType', 'assetType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('symbol.assetType')
      .getRawMany();

    const stats: { [assetType: string]: number } = {};
    results.forEach((result) => {
      stats[result.assetType] = parseInt(result.count, 10);
    });

    return stats;
  }

  // ==================== Label Related Methods ====================

  /**
   * 按標籤查詢股票
   */
  async findByLabels(
    labelIds: string[],
    exchangeArea?: string,
    assetType?: AssetType,
    limit?: number
  ): Promise<SymbolEntity[]> {
    if (labelIds.length === 0) return [];

    const queryBuilder = this.symbolRepository
      .createQueryBuilder('symbol')
      .innerJoin('entity_labels', 'el', 'el.entity_id = symbol.id')
      .innerJoin('labels', 'label', 'label.id = el.label_id')
      .where('el.entity_type = :entityType', { entityType: EntityType.SYMBOL })
      .andWhere('el.label_id IN (:...labelIds)', { labelIds })
      .andWhere('label.is_active = :isActive', { isActive: true })
      .groupBy('symbol.id')
      .having('COUNT(DISTINCT el.label_id) = :labelCount', {
        labelCount: labelIds.length,
      });

    if (exchangeArea) {
      queryBuilder.andWhere('symbol.exchange_area = :exchangeArea', {
        exchangeArea,
      });
    }

    if (assetType) {
      queryBuilder.andWhere('symbol.asset_type = :assetType', { assetType });
    }

    if (limit) {
      queryBuilder.limit(limit);
    }

    queryBuilder.orderBy('symbol.name', 'ASC');

    return await queryBuilder.getMany();
  }

  /**
   * 按標籤名稱查詢股票
   */
  async findByLabelNames(
    labelNames: string[],
    exchangeArea?: string,
    assetType?: AssetType,
    limit?: number
  ): Promise<SymbolEntity[]> {
    if (labelNames.length === 0) return [];

    const queryBuilder = this.symbolRepository
      .createQueryBuilder('symbol')
      .innerJoin('entity_labels', 'el', 'el.entity_id = symbol.id')
      .innerJoin('labels', 'label', 'label.id = el.label_id')
      .where('el.entity_type = :entityType', { entityType: EntityType.SYMBOL })
      .andWhere('label.name IN (:...labelNames)', { labelNames })
      .andWhere('label.is_active = :isActive', { isActive: true })
      .groupBy('symbol.id')
      .having('COUNT(DISTINCT label.name) = :labelCount', {
        labelCount: labelNames.length,
      });

    if (exchangeArea) {
      queryBuilder.andWhere('symbol.exchange_area = :exchangeArea', {
        exchangeArea,
      });
    }

    if (assetType) {
      queryBuilder.andWhere('symbol.asset_type = :assetType', { assetType });
    }

    if (limit) {
      queryBuilder.limit(limit);
    }

    queryBuilder.orderBy('symbol.name', 'ASC');

    return await queryBuilder.getMany();
  }

  /**
   * 獲取帶標籤的股票列表
   */
  async findWithLabels(
    exchangeArea?: string,
    assetType?: AssetType,
    limit?: number
  ): Promise<(SymbolEntity & { labels: LabelEntity[] })[]> {
    const queryBuilder = this.symbolRepository
      .createQueryBuilder('symbol')
      .leftJoinAndSelect(
        'entity_labels',
        'el',
        'el.entity_id = symbol.id AND el.entity_type = :entityType',
        { entityType: EntityType.SYMBOL }
      )
      .leftJoinAndSelect(
        'labels',
        'label',
        'label.id = el.label_id AND label.is_active = :isActive',
        { isActive: true }
      );

    if (exchangeArea) {
      queryBuilder.andWhere('symbol.exchange_area = :exchangeArea', {
        exchangeArea,
      });
    }

    if (assetType) {
      queryBuilder.andWhere('symbol.asset_type = :assetType', { assetType });
    }

    if (limit) {
      queryBuilder.limit(limit);
    }

    queryBuilder.orderBy('symbol.name', 'ASC');

    const result = await queryBuilder.getRawAndEntities();

    // 組織結果，將標籤附加到每個 symbol
    const symbolsWithLabels = result.entities.map((symbol) => {
      const labels = result.raw
        .filter((raw) => raw.symbol_id === symbol.id && raw.label_id)
        .map((raw) => ({
          id: raw.label_id,
          name: raw.label_name,
          type: raw.label_type,
          color: raw.label_color,
          description: raw.label_description,
          isActive: raw.label_is_active,
          usageCount: raw.label_usage_count,
          createdAt: raw.label_created_at,
          updatedAt: raw.label_updated_at,
        })) as LabelEntity[];

      return { ...symbol, labels };
    });

    return symbolsWithLabels;
  }

  /**
   * 獲取股票的標籤
   */
  async getSymbolLabels(symbolId: string): Promise<LabelEntity[]> {
    const result = await this.entityLabelRepository
      .createQueryBuilder('el')
      .leftJoinAndSelect('el.label', 'label')
      .where('el.entity_id = :symbolId', { symbolId })
      .andWhere('el.entity_type = :entityType', {
        entityType: EntityType.SYMBOL,
      })
      .andWhere('label.is_active = :isActive', { isActive: true })
      .orderBy('label.usage_count', 'DESC')
      .addOrderBy('label.name', 'ASC')
      .getMany();

    return result.map((el) => el.label);
  }

  /**
   * 為股票添加標籤
   */
  async addLabelToSymbol(symbolId: string, labelId: string): Promise<boolean> {
    try {
      // 檢查是否已存在
      const existing = await this.entityLabelRepository.findOne({
        where: { entityId: symbolId, entityType: EntityType.SYMBOL, labelId },
      });

      if (existing) {
        return true; // Already exists
      }

      // 創建新關聯
      const entityLabel = this.entityLabelRepository.create({
        entityId: symbolId,
        entityType: EntityType.SYMBOL,
        labelId,
      });

      await this.entityLabelRepository.save(entityLabel);

      // 增加標籤使用次數
      await this.labelRepository.increment(
        { id: labelId, isActive: true },
        'usageCount',
        1
      );

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 移除股票標籤
   */
  async removeLabelFromSymbol(
    symbolId: string,
    labelId: string
  ): Promise<boolean> {
    const result = await this.entityLabelRepository.delete({
      entityId: symbolId,
      entityType: EntityType.SYMBOL,
      labelId,
    });

    return (result.affected ?? 0) > 0;
  }

  /**
   * 批次為股票添加標籤
   */
  async addLabelsToSymbol(
    symbolId: string,
    labelIds: string[]
  ): Promise<number> {
    if (labelIds.length === 0) return 0;

    // 檢查已存在的標籤
    const existing = await this.entityLabelRepository.find({
      where: { entityId: symbolId, entityType: EntityType.SYMBOL },
      select: ['labelId'],
    });

    const existingLabelIds = existing.map((el) => el.labelId);
    const newLabelIds = labelIds.filter((id) => !existingLabelIds.includes(id));

    if (newLabelIds.length === 0) return 0;

    // 創建新關聯
    const entityLabels = newLabelIds.map((labelId) =>
      this.entityLabelRepository.create({
        entityId: symbolId,
        entityType: EntityType.SYMBOL,
        labelId,
      })
    );

    await this.entityLabelRepository.save(entityLabels);

    // 批次增加標籤使用次數
    await this.labelRepository
      .createQueryBuilder()
      .update(LabelEntity)
      .set({ usageCount: () => 'usage_count + 1' })
      .where('id IN (:...labelIds)', { labelIds: newLabelIds })
      .andWhere('is_active = :isActive', { isActive: true })
      .execute();

    return newLabelIds.length;
  }

  /**
   * 獲取股票標籤統計
   */
  async getSymbolLabelStats(exchangeArea?: string): Promise<
    {
      labelId: string;
      labelName: string;
      symbolCount: number;
    }[]
  > {
    const queryBuilder = this.entityLabelRepository
      .createQueryBuilder('el')
      .leftJoin('el.label', 'label')
      .leftJoin('symbols', 'symbol', 'symbol.id = el.entity_id')
      .select([
        'el.label_id as "labelId"',
        'label.name as "labelName"',
        'COUNT(el.id) as "symbolCount"',
      ])
      .where('el.entity_type = :entityType', { entityType: EntityType.SYMBOL })
      .andWhere('label.is_active = :isActive', { isActive: true });

    if (exchangeArea) {
      queryBuilder.andWhere('symbol.exchange_area = :exchangeArea', {
        exchangeArea,
      });
    }

    queryBuilder
      .groupBy('el.label_id, label.name')
      .orderBy('COUNT(el.id)', 'DESC');

    const result = await queryBuilder.getRawMany();

    return result.map((r) => ({
      labelId: r.labelId,
      labelName: r.labelName,
      symbolCount: parseInt(r.symbolCount, 10),
    }));
  }
}
