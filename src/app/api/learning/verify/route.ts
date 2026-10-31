import { authenticatedStaff, requireStaffSecurity, staffApiError } from "@/lib/staff-auth";
import { learningDeliveryUrl, verifyLearningDelivery } from "@/lib/learning-delivery";

export async function POST(request: Request) {
  try {
    await authenticatedStaff(request,true);await requireStaffSecurity();
    const body = await request.json().catch(() => null);
    let url: string;
    try {url=learningDeliveryUrl(body?.url,process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "");}
    catch {return Response.json({error:"Choose a document uploaded to this system's file host."},{status:400});}
    try {return Response.json(await verifyLearningDelivery(url));}
    catch(error){return Response.json({error:error instanceof Error?error.message:"Document delivery could not be checked. Please retry."},{status:422});}
  }catch(error){return staffApiError(error);}
}
