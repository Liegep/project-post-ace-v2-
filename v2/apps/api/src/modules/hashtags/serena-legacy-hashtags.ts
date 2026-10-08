import crypto from "node:crypto";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

const migrationKey = "2026-09-23-serena-v1-hashtag-groups";

export const serenaLegacyHashtagGroups = [
  { name: "Braies", hashtags: ["#braiesproposal", "#braiesengagement", "#lapalafitta#braiesengagement", "#lapalafitta", "#dolomitipatrimoniounesco", "#dolomitidelcadore", "#dolomitivenete", "#mountains", "#dolomitiunesco", "#dolomitesinstagram", "#dolomitiinstagram", "#dolomiti", "#passiondolomites", "#naturephotography", "#dolomitesphotographer", "#italia", "#panoramic", "#landscape", "#dolomitesproposal", "#dolomitesengagement", "#dolomitesengagementphotographer", "#dolomitesproposalphotographer", "#dolomitesengagementproposal", "#engagementproposaldolomites"] },
  { name: "Dolomites", hashtags: ["#emotional", "#emotionalphotography", "#lagodibraies", "#lagodibraiesofficial", "#lagodibraiesphoto", "#lagodibraiesphotographer", "#lagodibraiesphotography", "#lagodibraiesphotoshoot", "#braiesproposal", "#braiesengagement", "#lapalafitta", "#dolomitipatrimoniounesco", "#dolomitidelcadore", "#dolomitivenete", "#mountains", "#dolomitiunesco", "#dolomitesinstagram", "#dolomitiinstagram", "#dolomiti", "#passiondolomites", "#naturephotography", "#dolomitesphotographer", "#italia", "#panoramic", "#landscape", "#dolomitesproposal", "#dolomitesengagement", "#dolomitesengagementphotographer", "#dolomitesproposalphotographer", "#dolomitesengagementproposal", "#engagementproposaldolomites"] },
  { name: "Dubai", hashtags: ["#dubaiengagement", "#dubaiphotographer", "#dubaiengagementphotographer", "#desertphotoshoot", "#dubaidesert", "#dubaidesertengagement", "#dubaidesertphotographysession", "#dubai", "#luxurydubai", "#dubailife", "#dubaiweddingphotographer", "#dubaihoneymoon", "#dubaicoupleshoot", "#coupleshootdubai"] },
  { name: "Edinburgh", hashtags: ["#edinburgh", "#edinburghcity", "#edinburghscotland", "#edinburghlife", "#edinburghphotography", "#edinburghshots", "#edinburghhighlights", "#edinburghclicks", "#edinburghwedding", "#edinburghphotographer", "#edinburgh_snapshots", "#edinburghweddingphotographer", "#edinburghviews", "#edinburghweddings"] },
  { name: "Edinburgh 2", hashtags: ["#edinburghscotland", "#edinburgh", "#edinburgh_snapshots", "#edinburghweddingphotographer", "#edinburghphotography", "#edinburgo", "#edinburghstyle", "#edinburghbeauty", "#thisisedinburgh", "#edinburghweddings", "#edinburghtravel", "#edinburghlife"] },
  { name: "Florence", hashtags: ["#florence", "#florenceitaly", "#florencewedding", "#florenceandtuscany", "#florenceweddingphotographer", "#florenceilove", "#florencephotography", "#florencegram", "#florenceinlove", "#florencecity"] },
  { name: "Italy", hashtags: ["#italy", "#italytravel", "#italygram", "#italyiloveyou", "#madeinitaly", "#italylovers", "#italyphoto", "#italy_photolovers", "#visititaly", "#italy_creative_pictures", "#new_photoitaly", "#italystyle", "#discoveritaly", "#travelitaly", "#ilikeitaly", "#italylove", "#fromitalywithlove", "#italyphotolovers", "#italylife"] },
  { name: "Lake Garda", hashtags: ["#lakegarda", "#lakegardaphotographer", "#italyphotographer", "#coupleshootitaly", "#engagementitaly", "#italyengagementphotographer", "#italyphotoshoot", "#romanticitaly", "#italylovers", "#destinationphotographer", "#europephotoshoot"] },
  { name: "Misurina", hashtags: ["#lagodimisurina", "#lagodimisurina🌲", "#misurina", "#misurinalake", "#misurinasee", "#dolomites", "#dolomitesphotographer", "#misurinaphotographer", "#misurinaengagement", "#lagodimisurinaengagement", "#lagodimisurinaphotographer", "#misurinalakephotographer", "#lakemisurina", "#lakemisurinaitaly", "#dolomitesengagementphotographer", "#dolomitesengagement", "#dolomitiengagementsession"] },
  { name: "Venice", hashtags: ["#veniceitaly", "#venicephotographer", "#photographervenice", "#honeymooninvenice", "#weddingphotographer", "#weddingphotographervenice", "#venicewedding", "#veniceweddingphotographer", "#venicecoupleshoot", "#engagementvenice", "#veniceengagementphotographer", "#veniceengagement", "#venicephotography", "#bestphotographervenice", "#venicelovers", "#venice", "#exclusivevenice", "#photoshootinvenice", "#loveinvenice", "#surpriseweddingproposal", "#surpriseweddingproposalvenice", "#veniceproposal", "#trevisoproposal", "#veniceproposalphotographer", "#veniceportraitphotographer", "#venicephotoshoot", "#venicevacationphotographer", "#venicehoneymoon"] },
  { name: "Venice 2", hashtags: ["#emotional", "#emotionalphotography", "#venice", "#venicephotographer", "#veniceproposal", "#veniceproposalphotographer", "#veniceengagement", "#veniceengagementphotographer", "#veniceengagementphotography", "#couplegoals", "#couplephotography", "#venicecouplesession", "#venicecouplephotographer"] },
] as const;

/** Imports the recovered V1 groups exactly once, replacing manual groups with the same names. */
export async function importSerenaLegacyHashtagGroups(db: Pool) {
  await db.query(`CREATE TABLE IF NOT EXISTS app_data_migrations (
    migration_key VARCHAR(190) NOT NULL PRIMARY KEY,
    applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [claim] = await connection.query<ResultSetHeader>(
      "INSERT IGNORE INTO app_data_migrations (migration_key) VALUES (?)",
      [migrationKey],
    );
    if (claim.affectedRows === 0) {
      await connection.commit();
      return 0;
    }

    const [clients] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM client_accounts WHERE slug = ? LIMIT 1",
      ["serena-genovese"],
    );
    const clientAccountId = clients[0]?.id as string | undefined;
    if (!clientAccountId) {
      await connection.rollback();
      return 0;
    }

    const names = serenaLegacyHashtagGroups.map((group) => group.name.toLocaleLowerCase("en-US"));
    await connection.query(
      `DELETE FROM hashtag_groups WHERE client_account_id = ? AND LOWER(TRIM(name)) IN (${names.map(() => "?").join(", ")})`,
      [clientAccountId, ...names],
    );

    for (const [index, group] of serenaLegacyHashtagGroups.entries()) {
      await connection.query(
        "INSERT INTO hashtag_groups (id, client_account_id, name, hashtags_json, legacy_id) VALUES (?, ?, ?, ?, ?)",
        [crypto.randomUUID(), clientAccountId, group.name, JSON.stringify(group.hashtags), `serena-v1:${index + 1}`],
      );
    }
    await connection.commit();
    return serenaLegacyHashtagGroups.length;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
