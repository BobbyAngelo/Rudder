import { NextResponse, NextRequest } from "next/server";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const REPO_ROOT = join(process.cwd(), "..");

type DriveRecord = {
  id: string;
  name: string;
  mountPath: string;
  description: string;
  manifestFile: string;
  capacity?: string;
  status: string;
  tags: string[];
};

type FolderNode = {
  name: string;
  path: string;
  images: number;
  videos: number;
  imageSize: number;
  videoSize: number;
  sampleImages: string[];
  sampleVideos: string[];
  children: FolderNode[];
};

function getDriveRegistry(): DriveRecord[] {
  const dbPath = join(REPO_ROOT, "data", "drives", "drives-database.json");
  if (!existsSync(dbPath)) return [];
  try {
    const data = JSON.parse(readFileSync(dbPath, "utf-8"));
    return data.drives || [];
  } catch (error) {
    console.error("Error reading drives-database.json:", error);
    return [];
  }
}

function buildTree(folders: Record<string, {
  images?: number;
  videos?: number;
  image_size?: number;
  video_size?: number;
  sample_images?: string[];
  sample_videos?: string[];
}>): FolderNode[] {
  const roots: FolderNode[] = [];
  const sortedPaths = Object.keys(folders).sort();

  for (const folderPath of sortedPaths) {
    const data = folders[folderPath];
    const parts = folderPath.split("/");
    let current = roots;
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLeaf = i === parts.length - 1;

      let existing = current.find(n => n.name === part);
      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          images: isLeaf ? (data.images || 0) : 0,
          videos: isLeaf ? (data.videos || 0) : 0,
          imageSize: isLeaf ? (data.image_size || 0) : 0,
          videoSize: isLeaf ? (data.video_size || 0) : 0,
          sampleImages: isLeaf ? (data.sample_images || []).slice(0, 5) : [],
          sampleVideos: isLeaf ? (data.sample_videos || []).slice(0, 3) : [],
          children: [],
        };
        current.push(existing);
      } else if (isLeaf) {
        existing.images += data.images || 0;
        existing.videos += data.videos || 0;
        existing.imageSize += data.image_size || 0;
        existing.videoSize += data.video_size || 0;
        if (data.sample_images) existing.sampleImages = data.sample_images.slice(0, 5);
        if (data.sample_videos) existing.sampleVideos = data.sample_videos.slice(0, 3);
      }

      current = existing.children;
    }
  }

  return roots;
}

export async function GET(request: NextRequest) {
  try {
    const registry = getDriveRegistry();
    const url = new URL(request.url);
    const driveId = url.searchParams.get("drive");

    if (driveId) {
      // Return specific drive details
      const drive = registry.find(d => d.id === driveId);
      if (!drive) return NextResponse.json({ error: "Unknown drive" }, { status: 404 });

      const manifestPath = join(REPO_ROOT, drive.manifestFile);
      if (!existsSync(manifestPath)) {
        return NextResponse.json({
          ...drive,
          mounted: existsSync(drive.mountPath),
          hasManifest: false,
          scanDate: null,
          totals: null,
          tree: [],
        });
      }

      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
        const mounted = existsSync(drive.mountPath);
        const tree = buildTree(manifest.folders || {});

        return NextResponse.json({
          ...drive,
          mounted,
          hasManifest: true,
          scanDate: manifest.scanDate,
          totals: {
            images: manifest.totals.images || 0,
            videos: manifest.totals.videos || 0,
            imageSizeBytes: manifest.totals.imageSizeBytes || manifest.totals.image_size || 0,
            videoSizeBytes: manifest.totals.videoSizeBytes || manifest.totals.video_size || 0,
          },
          tree,
          folderCount: Object.keys(manifest.folders || {}).length,
        });
      } catch (error: any) {
        console.error("Error reading manifest file:", error);
        return NextResponse.json({ error: "Malformed manifest file" }, { status: 500 });
      }
    }

    // Return all drives summary
    const results = registry.map(drive => {
      const manifestPath = join(REPO_ROOT, drive.manifestFile);
      const hasManifest = existsSync(manifestPath);
      const mounted = existsSync(drive.mountPath);

      let totals = null;
      let scanDate = null;
      let folderCount = 0;

      if (hasManifest) {
        try {
          const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
          totals = {
            images: manifest.totals.images || 0,
            videos: manifest.totals.videos || 0,
            imageSizeBytes: manifest.totals.imageSizeBytes || manifest.totals.image_size || 0,
            videoSizeBytes: manifest.totals.videoSizeBytes || manifest.totals.video_size || 0,
          };
          scanDate = manifest.scanDate;
          folderCount = Object.keys(manifest.folders || {}).length;
        } catch { /* malformed manifest */ }
      }

      return {
        ...drive,
        mounted,
        hasManifest,
        scanDate,
        totals,
        folderCount,
      };
    });

    // Auto-discover unknown mounted volumes on macOS
    try {
      if (existsSync("/Volumes")) {
        const volumes = readdirSync("/Volumes").filter(v => !v.startsWith(".") && v !== "Macintosh HD");
        const knownMounts = registry.map(d => d.mountPath.replace("/Volumes/", ""));
        const unknown = volumes.filter(v => !knownMounts.includes(v));
        
        for (const vol of unknown) {
          const volPath = `/Volumes/${vol}`;
          try {
            statSync(volPath);
            results.push({
              id: vol.toLowerCase().replace(/\s+/g, "-"),
              name: vol,
              mountPath: volPath,
              description: "Unregistered volume — add to drives-database.json to track.",
              manifestFile: "",
              capacity: undefined,
              status: "unknown",
              tags: ["unregistered"],
              mounted: true,
              hasManifest: false,
              scanDate: null,
              totals: null,
              folderCount: 0,
            });
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      console.warn("Could not read /Volumes folder for auto-discovery:", e);
    }

    return NextResponse.json({ drives: results });
  } catch (error: any) {
    console.error("Drives API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
