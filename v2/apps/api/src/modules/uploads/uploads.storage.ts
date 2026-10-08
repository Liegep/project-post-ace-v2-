import { constants } from "node:fs";
import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const uploadFilePattern = /^[a-f0-9-]+\.(webp|png|jpg|jpeg|mp4|webm|mov|pdf|svg)$/;

export function getApiDirectory() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

function findHostingerVersionsDirectory(apiDirectory: string) {
  let current = apiDirectory;
  while (true) {
    const parent = path.dirname(current);
    if (path.basename(parent) === "versions") return parent;
    if (parent === current) return null;
    current = parent;
  }
}

function resolveUploadStorage(uploadDir: string) {
  if (path.isAbsolute(uploadDir)) {
    return { directory: uploadDir, persistent: true };
  }

  const apiDirectory = getApiDirectory();
  const versionsDirectory = findHostingerVersionsDirectory(apiDirectory);
  if (versionsDirectory) {
    return {
      directory: path.resolve(path.dirname(versionsDirectory), uploadDir),
      persistent: true,
    };
  }

  return {
    directory: path.resolve(apiDirectory, uploadDir),
    persistent: false,
  };
}

export function getUploadDirectory(uploadDir: string) {
  return resolveUploadStorage(uploadDir).directory;
}

async function legacyUploadDirectories(targetDirectory: string) {
  const apiDirectory = getApiDirectory();
  const candidates = [path.join(apiDirectory, "uploads")];
  const versionsDirectory = findHostingerVersionsDirectory(apiDirectory);

  if (versionsDirectory) {
    const versions = await readdir(versionsDirectory, { withFileTypes: true }).catch(() => []);
    for (const version of versions) {
      if (!version.isDirectory()) continue;
      candidates.push(path.join(versionsDirectory, version.name, "nodejs", "apps", "api", "uploads"));
    }
  }

  return [...new Set(candidates)].filter((directory) => path.resolve(directory) !== path.resolve(targetDirectory));
}

async function migrateLegacyUploads(targetDirectory: string) {
  let migrated = 0;
  const sources = await legacyUploadDirectories(targetDirectory);

  for (const source of sources) {
    const files = await readdir(source, { withFileTypes: true }).catch(() => []);
    for (const file of files) {
      if (!file.isFile() || !uploadFilePattern.test(file.name)) continue;
      try {
        await copyFile(path.join(source, file.name), path.join(targetDirectory, file.name), constants.COPYFILE_EXCL);
        migrated += 1;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    }
  }

  return migrated;
}

export async function prepareUploadStorage(uploadDir: string) {
  const storage = resolveUploadStorage(uploadDir);
  await mkdir(storage.directory, { recursive: true });

  const probe = path.join(storage.directory, `.design-hub-write-test-${process.pid}`);
  await writeFile(probe, "ok", { flag: "wx" });
  await rm(probe, { force: true });

  const migrated = storage.persistent ? await migrateLegacyUploads(storage.directory) : 0;
  return { persistent: storage.persistent, migrated };
}
