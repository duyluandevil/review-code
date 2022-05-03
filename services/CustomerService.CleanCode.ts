import { kiotVietSdk } from "../sdk/kiotVietSdk";
import { ItemsService } from "directus";
import { customerKiotViet } from "../types/customerKiotViet";
import { TRANSACTION_TYPE_IN } from "./TransactionService";

export type transactionPayload = {
    payload: {
        [key: string]: any
    },
    key: number,
    collections: 'transaction'
}

export const INDEX_STRING_GET_DATE_START = 0
export const INDEX_STRING_GET_DATE_END = 10

export class CustomerService {
    private serviceDb: any
    private schema: any

    constructor(serviceDb: any, schema: any) {
        this.serviceDb = serviceDb;
        this.schema = schema;
    }

    //create customer
    public async create(customerData: customerKiotViet) {
        let inputCustomerData = {
            id: customerData.id,
            code: customerData.code,
            name: customerData.name,
            address: customerData.address,
            credit: 0
        }

        const modelService = await this.createRelation("customer")
        return await modelService.createOne(inputCustomerData)
    }

    //update customer with kiotviet
    public async update(customerId: number) {
        let customerModel: any = await this.getModelById("customer", customerId)
        let customerApiKiotViet = await kiotVietSdk.customer.get(customerId);

        //Kiểm tra user trong directus có tồn tại không
        if (!customerModel) { // không có trong directus
            await this.createCustomerWithKiotViet(customerApiKiotViet)
        } else {
            
            if(await this.isDateLessMonth(customerModel)){
                let inputCustomerData = {
                    code: customerApiKiotViet.code,
                    name: customerApiKiotViet.name,
                    email: customerApiKiotViet.email,
                    address: customerApiKiotViet.address,
                    credit: 0,
                    date_updated: customerApiKiotViet.modifiedDate
                }

                await this.updateModelById("customer", customerId, inputCustomerData)
            }
        }
    }

    public async createCustomerWithKiotViet(inputCustomerDataFromKiot: any) {
        let inputCustomerDataKiot = {
            id: inputCustomerDataFromKiot.id,
            code: inputCustomerDataFromKiot.code,
            name: inputCustomerDataFromKiot.name,
            email: inputCustomerDataFromKiot.email,
            address: inputCustomerDataFromKiot.address,
            credit: 0,
            date_created: inputCustomerDataFromKiot.createdDate,
            date_updated: inputCustomerDataFromKiot.modifiedDate
        }

        const customerService = await this.createRelation("customer")
        await customerService.createOne(inputCustomerDataKiot)
    }

    public async isDateLessMonth(inputCustomerData) {
        const currentDate = new Date()
        const dateCustomerDirectus = new Date(inputCustomerData.date_updated)

        const TOTAL_DAY_FOR_NEXT_MONTH = 30
        dateCustomerDirectus.setDate(dateCustomerDirectus.getDate() + TOTAL_DAY_FOR_NEXT_MONTH) // Lấy ngày ở thời điểm 1 tháng sau

        if(dateCustomerDirectus < currentDate) // So sánh nếu cập nhật trong thời gian 30 ngày, so sánh với ngày hiện tại
            return true

        return false
    }

    // Cập nhật số dư 
    public async updateCredit(transactionData: transactionPayload) {

        const customerOne = await this.getModelById("customer", transactionData.payload.customer_id)
        const transactionOne = await this.getModelById("transaction", transactionData.key)

        var dataUpdate = await this.isCustomerCreditExist(customerOne)

        await this.isTransacionExist(transactionOne)

        await this.checkTransactionType(transactionOne.type, dataUpdate, transactionOne)

        await this.updateModelById("transaction", transactionData.payload.customer_id, dataUpdate)
    }

    public async isCustomerCreditExist(inputCustomerDate: any){
        return { credit: inputCustomerDate ? inputCustomerDate.credit : 0 } //Trả về credit nếu dữ liệu customer tồn tại, nếu không trả về 0
    }

    public async isTransacionExist(inputTransactionData) {
        if (!inputTransactionData)
            console.log("Không tìm thấy Transaction, coi lại")
    }

    public async checkTransactionType(inputType: number, inputData: any, inputTransactionData: any) {
        // Kiểm tra type của transaction để cập nhật số dư
        // 1 là thu vào
        if (+inputType === TRANSACTION_TYPE_IN) {
            inputData.credit = (+inputData.credit) + (+inputTransactionData.amount);
        } else {
            inputData.credit = (+inputData.credit) - (+inputTransactionData.amount);
        }
    }

    public async createRelation(modelName: string) {
        const { ItemsService } = this.serviceDb;
        const modelService: ItemsService = new ItemsService(modelName, { schema: this.schema });

        return await modelService
    }

    public async getModelById(modelName: string, input: any) {
        const modelService = await this.createRelation(modelName)
        return await modelService.readOne(input)
    }

    public async updateModelById(modelName: string, idModel: any, input: any) {
        const modelService = await this.createRelation(modelName)
        await modelService.updateOne(idModel, input)
    }

}