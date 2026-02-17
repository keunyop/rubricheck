import { POST as gradePost } from "../grade/route";

export async function POST(request: Request) {
  return gradePost(request);
}
