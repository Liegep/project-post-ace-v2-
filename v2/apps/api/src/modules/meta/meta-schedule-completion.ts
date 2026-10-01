export async function completeMetaScheduling<T>(
  createPublications: () => Promise<T>,
  moveCardToScheduled: () => Promise<unknown>,
) {
  const result = await createPublications();
  await moveCardToScheduled();
  return result;
}
