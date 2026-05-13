import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module.js";
import { JournalResolverService } from "./journal-resolver.service.js";

@Global()
@Module({
    imports: [PrismaModule],
    providers: [JournalResolverService],
    exports: [JournalResolverService],
})
export class JournalResolverModule { }