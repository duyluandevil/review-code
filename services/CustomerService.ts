import {kiotVietSdk} from "../sdk/kiotVietSdk";
import {ItemsService} from "directus";
import {customerKiotViet} from "../types/customerKiotViet";
import {TRANSACTION_TYPE_IN} from "./TransactionService";

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

    constructor(serviceDb : any, schema: any ){
        this.serviceDb = serviceDb;
        this.schema = schema;
    }

    //update customer with kiotviet
    public async update(customerId: number){

        // Tạo kết nối tới collection trong directus
        const {ItemsService} = this.serviceDb;
        const customerService: ItemsService = new ItemsService('customer', {
            schema: this.schema
        });

        // Lấy customer từ customerId trong directus
        let customerModel : any = await this.getById(customerId)

        // Lấy dữ liệu customer từ kiotviet
        let customerApiKiotViet = await kiotVietSdk.customer.get(customerId);

        // console.log(customerApiKiotViet.data)

        //Kiểm tra user trong directus có tồn tại không
        if(!customerModel){ // không có trong directus
            console.log("Không có trong directus", customerModel)
            await customerService.createOne({
                id: customerApiKiotViet.id,
                code: customerApiKiotViet.code,
                name: customerApiKiotViet.name,
                email: customerApiKiotViet.email,
                address: customerApiKiotViet.address,
                credit: 0,
                date_created: customerApiKiotViet.createdDate,
                date_updated: customerApiKiotViet.modifiedDate
            })
        }else{
            console.log("Có trong directus", customerModel)
            // Lấy thời gian của customer từ 2 model (kiotV, directus)
            // @ts-ignore


            const dateCustomerDirectus = new Date(customerModel.date_updated.slice(INDEX_STRING_GET_DATE_START, INDEX_STRING_GET_DATE_END))
            const currentDate = new Date() // Lấy thời gian hiện tại

            // Tự động chuyển đổi sang date
            const TOTAL_DAY_FOR_NEXT_MONTH = 30
            dateCustomerDirectus.setDate(dateCustomerDirectus.getDate() + TOTAL_DAY_FOR_NEXT_MONTH)

            if(dateCustomerDirectus < currentDate){
                await customerService.updateOne(customerId, {
                    code: customerApiKiotViet.code,
                    name: customerApiKiotViet.name,
                    email: customerApiKiotViet.email,
                    address: customerApiKiotViet.address,
                    credit: 0,
                    date_updated: customerApiKiotViet.modifiedDate
                })
            }
        }
    }

    // Cập nhật số dư
    public async updateCredit(transactionData: transactionPayload){
        const {ItemsService} = this.serviceDb;

        const customerService: ItemsService = new ItemsService('customer', { schema: this.schema });
        const transactionService: ItemsService = new ItemsService('transaction', { schema: this.schema});

        let customerOne = await customerService.readOne(transactionData.payload.customer_id)
        const transactionOne = await transactionService.readOne(transactionData.key)

        var dataUpdate = {
            credit: customerOne ? customerOne.credit : 0
        }

        console.log(transactionOne)

        if (!transactionOne) {
            console.log("Không tìm thấy Transaction, Coi lại")
        }


        // Kiểm tra type của transaction để cập nhật số dư
        // 1 là thu vào
        if(+transactionOne.type === TRANSACTION_TYPE_IN){
            dataUpdate.credit = (+dataUpdate.credit) + (+transactionOne.amount);
        }else{
            dataUpdate.credit = (+dataUpdate.credit) - (+transactionOne.amount);
        }

        await customerService.updateOne(transactionData.payload.customer_id, dataUpdate)
    }

    //get customer
    public async getById(customerId: number){
        const {ItemsService} = this.serviceDb;
        const customerService: ItemsService = new ItemsService('customer', {
            schema: this.schema
        });


        // Không có kết quả trả về false từ func catch()
        let customerModel = await customerService.readOne(customerId).catch(() => false);

        return customerModel;
    }

    //create customer
    public async create(customerData: customerKiotViet){

        const {ItemsService} = this.serviceDb;
        const customerService: ItemsService = new ItemsService('customer', {
            schema: this.schema
        });

        await customerService.createOne({
            id: customerData.id,
            code: customerData.code,
            name: customerData.name,
            address: customerData.address,
            credit: 0
        })
    }

}