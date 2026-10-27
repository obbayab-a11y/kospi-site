import { PrismaClient } from "@prisma/client";
import { classify } from "../fear-greed/classify";
import type { FactorKey, FactorRawData, FearGreedDaily } from "../fear-greed/types";
import type { SnapshotStore } from "./snapshot-store";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = new PrismaClient();
  return globalForPrisma.prisma;
}

interface PersistedExtras {
  appliedWeights: Partial<Record<FactorKey, number>>;
  missingFactors: FactorKey[];
}

export class PrismaSnapshotStore implements SnapshotStore {
  readonly driver = "prisma" as const;

  async load(): Promise<FearGreedDaily[] | null> {
    const rows = await getClient().fearGreedDaily.findMany({ orderBy: { date: "asc" } });
    if (rows.length === 0) return null;
    return rows.map((r) => {
      const extras = JSON.parse(r.meta) as PersistedExtras;
      return {
        date: r.date,
        score: r.score,
        classification: classify(r.score),
        kospiClose: r.kospiClose,
        momentumScore: r.momentumScore,
        volatilityScore: r.volatilityScore,
        breadthScore: r.breadthScore,
        foreignFlowScore: r.foreignFlowScore,
        marketStrengthScore: r.marketStrengthScore,
        putCallScore: r.putCallScore,
        riskAppetiteScore: r.riskAppetiteScore,
        rawData: JSON.parse(r.rawData) as FactorRawData,
        appliedWeights: extras.appliedWeights,
        missingFactors: extras.missingFactors,
        updatedAt: r.updatedAt.toISOString(),
      };
    });
  }

  async save(series: readonly FearGreedDaily[]): Promise<void> {
    const prisma = getClient();
    const ops = series.map((d) => {
      const data = {
        score: d.score,
        classification: d.classification,
        kospiClose: d.kospiClose,
        momentumScore: d.momentumScore,
        volatilityScore: d.volatilityScore,
        breadthScore: d.breadthScore,
        foreignFlowScore: d.foreignFlowScore,
        marketStrengthScore: d.marketStrengthScore,
        putCallScore: d.putCallScore,
        riskAppetiteScore: d.riskAppetiteScore,
        rawData: JSON.stringify(d.rawData),
        meta: JSON.stringify({
          appliedWeights: d.appliedWeights,
          missingFactors: d.missingFactors,
        } satisfies PersistedExtras),
        updatedAt: new Date(d.updatedAt),
      };
      return prisma.fearGreedDaily.upsert({
        where: { date: d.date },
        create: { date: d.date, ...data },
        update: data,
      });
    });
    // SQLite 단일 트랜잭션 크기를 제한하기 위해 나눠서 저장
    for (let i = 0; i < ops.length; i += 500) {
      await prisma.$transaction(ops.slice(i, i + 500));
    }
  }
}
