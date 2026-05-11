import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    const endpoint = config.getOrThrow<string>("S3_ENDPOINT");
    const region = config.getOrThrow<string>("S3_REGION");
    const accessKeyId = config.getOrThrow<string>("S3_ACCESS_KEY");
    const secretAccessKey = config.getOrThrow<string>("S3_SECRET_KEY");
    const forcePathStyle = (config.get<string>("S3_FORCE_PATH_STYLE") ?? "false") === "true";
    this.bucket = config.getOrThrow<string>("S3_BUCKET");

    this.s3 = new S3Client({
      region,
      endpoint,
      forcePathStyle,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async presignPutObject(key: string, contentType: string) {
    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    return getSignedUrl(this.s3, cmd, { expiresIn: 60 * 10 });
  }

  async presignGetObject(key: string) {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, cmd, { expiresIn: 60 * 10 });
  }
}
