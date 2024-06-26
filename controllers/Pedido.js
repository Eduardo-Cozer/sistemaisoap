import PedidoModel from "../models/Pedido.js"
import ClienteModel from "../models/Cliente.js"
import ProdutoModel from "../models/Produto.js"
import PDFDocument from "pdfkit-table"

class Pedido extends PedidoModel {
    constructor() {
      super()
    }
  
    async home(req, res) {
        try {
            const pedidos = await Pedido.find()
                .populate({
                    path: 'cliente',
                    select: 'nome'
                })
                .populate({
                    path: 'itens.produto',
                    select: 'nome preco'
                })
                .sort({ data: 'desc' })
            res.render('index', { pedidos })
        } catch (err) {
            req.flash('error_msg', 'Houve um erro ao exibir os pedidos recentes')
            res.status(500).redirect('/home')
        }
    }
  
    async list(req, res) {
        try {
            const pedidos = await Pedido.find()
                .populate({
                    path: 'cliente',
                    select: 'nome'
                })
                .populate({
                    path: 'itens.produto',
                    select: 'nome preco'
                })
                .sort({ data: 'desc' })
            res.render('pedidos/pedidos', { pedidos })
        } catch (err) {
            req.flash('error_msg', 'Houve um erro ao listar pedidos')
            res.status(500).redirect('/home')
        }
    }

    async addPage(req, res) {
        try {
            const [clientes, produtos] = await Promise.all([
                ClienteModel.find(),
                ProdutoModel.find()
            ])
            res.render("pedidos/addpedidos", { clientes, produtos })
        } catch (err) {
            req.flash("error_msg", "Houve um erro ao carregar o formulário")
            res.status(500).redirect("/pedidos")
        }   
    }

    async add(req, res){
        const { cliente, pagamento, frete, descricao, total, produto, quantidade } = req.body
        
        try {
            if (!cliente || cliente === "0" || !pagamento || pagamento === "0" || !total || total === "0" || !frete || !produto || !quantidade) {
                req.flash("error_msg", "Por favor, preencha todos os campos obrigatórios.")
                return res.status(400).redirect("/pedidos/add")
            }

            for (let i = 0; i < produto.length; i++) {
                const prod = await ProdutoModel.findById(produto[i])
                if (!prod) {
                    req.flash("error_msg", `Produto não encontrado para ID: ${produto[i]}`)
                    return res.status(404).redirect("/pedidos/add")
                }
                if (quantidade[i] > prod.quantidade) {
                    req.flash("error_msg", `Estoque insuficiente para o produto: ${prod.nome}`)
                    return res.status(400).redirect("/pedidos/add")
                }
            }

            const novoPedido = new PedidoModel({
                cliente,
                itens: produto.map((prodId, index) => ({ produto: prodId, quantidade: quantidade[index] })),
                frete,
                pagamento,
                descricao,
                total
            });

            await novoPedido.save();

            for (let i = 0; i < produto.length; i++) {
                await ProdutoModel.findByIdAndUpdate(produto[i], { $inc: { quantidade: -quantidade[i] } })
            }

            req.flash("success_msg", "Pedido criado com sucesso!")
            res.redirect("/pedidos")
        } catch (error) {
            req.flash("error_msg", "Erro ao criar pedido, tente novamente.")
            res.status(500).redirect("/pedidos/add")
        }
    }

    async editPage(req, res) {
        try {
            const pedido = await Pedido.findOne({ _id: req.params.id })
                .populate('cliente')
                .populate('itens.produto')
            const [clientes, produtos] = await Promise.all([
                ClienteModel.find(),
                ProdutoModel.find()
            ])
            res.render("pedidos/editpedidos", { clientes, produtos, pedido })
        } catch (err) {
            req.flash("error_msg", "Houve um erro ao carregar o formulário de edição")
            res.status(500).redirect("/pedidos")
        }
    }

    async edit(req, res) {
        try {
            const pedido = await Pedido.findOne({ _id: req.body.id })
            const { cliente, pagamento, frete, descricao, total, produto, quantidade } = req.body
    
            if (!cliente || cliente === "0" || !pagamento || pagamento === "0" || !total || total === "0" || !frete || !produto || !quantidade) {
                req.flash("error_msg", "Por favor, preencha todos os campos obrigatórios.")
                return res.status(400).redirect(`/pedidos/edit/${req.body.id}`)
            }
    
            if (!pedido.itens) {
                pedido.itens = []
            }

            for (let i = 0; i < produto.length; i++) {
                if (!pedido.itens[i]) {
                    pedido.itens[i] = { quantidade: 0 }
                }
    
                const prod = await ProdutoModel.findById(produto[i]);
                if (!prod) {
                    req.flash("error_msg", `Produto não encontrado para ID: ${produto[i]}`)
                    return res.status(404).redirect(`/pedidos/edit/${req.body.id}`)
                }
    
                const diferencaQuantidade = quantidade[i] - pedido.itens[i].quantidade
                if (diferencaQuantidade > prod.quantidade) {
                    req.flash("error_msg", `Estoque insuficiente para o produto: ${prod.nome}`)
                    return res.status(400).redirect(`/pedidos/edit/${req.body.id}`)
                }
            }

            for (let i = 0; i < pedido.itens.length; i++) {
                const item = pedido.itens[i];
                const novaQuantidade = quantidade[i] || 0;
                const diferencaQuantidade = novaQuantidade - item.quantidade;
                await ProdutoModel.findByIdAndUpdate(item.produto, { $inc: { quantidade: -diferencaQuantidade } })
                }
            
            for (let i = 0; i < produto.length; i++) {
                const diferencaQuantidade = quantidade[i] - pedido.itens[i].quantidade;
                if (diferencaQuantidade > 0) {
                    await ProdutoModel.findByIdAndUpdate(produto[i], { $inc: { quantidade: -diferencaQuantidade } })
                }
            }
    
            for (let i = 0; i < produto.length; i++) {
                const diferencaQuantidade = quantidade[i] - pedido.itens[i].quantidade;
                if (diferencaQuantidade < 0) {
                    await ProdutoModel.findByIdAndUpdate(produto[i], { $inc: { quantidade: -diferencaQuantidade } })
                }
            }

            pedido.cliente = cliente;
            pedido.itens = produto.map((prodId, index) => ({ produto: prodId, quantidade: quantidade[index] || 0 }))
            pedido.frete = frete;
            pedido.pagamento = pagamento;
            pedido.descricao = descricao;
            pedido.total = total;
    
            await pedido.save();
    
            req.flash("success_msg", "Pedido editado com sucesso!")
            res.redirect("/pedidos");
        } catch (error) {
            req.flash("error_msg", "Houve um erro ao editar o pedido")
            console.error(error);
            res.status(500).redirect(`/pedidos/edit/${req.body.id}`)
        }
    }
    

    async delete(req, res) {
        try {
            const pedido = await Pedido.findOne({ _id: req.params.id }).populate('itens.produto')
    
            if(!pedido){
                req.flash("error_msg", "Pedido não encontrado")
                return res.status(404).redirect("/pedidos")
            }
    
            for(const item of pedido.itens){
                await ProdutoModel.findByIdAndUpdate(item.produto._id, { $inc: { quantidade: item.quantidade } })
            }
    
            await Pedido.deleteOne({ _id: req.params.id })
    
            req.flash("success_msg", "Pedido deletado com sucesso")
            res.redirect("/pedidos")
        } catch (err) {
            req.flash("error_msg", "Houve um erro ao deletar o pedido")
            res.status(500).redirect("/pedidos")
        }
    }

    async generatePDF(req, res) {
        try {
            const pedido = await Pedido.findById(req.params.id)
                .populate("cliente")
                .populate("itens.produto")
    
            if(!pedido){
                throw new Error("Pedido não encontrado")
            }
    
            const doc = new PDFDocument()
    
            let buffers = []
            doc.on('data', buffers.push.bind(buffers))
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers)
                res.setHeader("Content-Type", "application/pdf")
                res.setHeader("Content-Disposition", 'inline; filename="pedido.pdf"')
                res.end(pdfData)
            });
    
            doc.fontSize(20).text("Relatório do Pedido", { align: "center" }).moveDown()
            doc.fontSize(12).text(`Data: ${pedido.data.toLocaleDateString()}`, {align: "right"}).moveDown()

            doc.fontSize(16).text("Dados do Cliente:", { underline: true }).moveDown()
            doc.fontSize(12).text(`Nome: ${pedido.cliente.nome}`)
            doc.fontSize(12).text(`Telefone: ${pedido.cliente.telefone}`)
            doc.fontSize(12).text(`Endereço: ${pedido.cliente.rua}, ${pedido.cliente.numero}`)
            doc.fontSize(12).text(`Bairro: ${pedido.cliente.bairro}`)
            doc.fontSize(12).text(`Cidade: ${pedido.cliente.cidade}`)
            if(pedido.cliente.complemento){
                doc.fontSize(12).text(`Complemento: ${pedido.cliente.complemento}`)
            }
            doc.moveDown();

            const table = {
                title: `Itens do pedido ${pedido.numeroPedido}`,
                headers: ["Produto", "Quantidade", "Unitário (R$)", "Total (R$)"],
                rows: pedido.itens.map(item => [
                    item.produto.nome,
                    item.quantidade,
                    item.produto.preco.toFixed(2),
                    (item.quantidade * item.produto.preco).toFixed(2)
                ]),
            };

            await doc.table(table, { margin: { top: 12 } });
            doc.moveDown();


            doc.fontSize(16).text("Informações do Pedido:", { underline: true }).moveDown()
            doc.fontSize(12).text(`Forma de Pagamento: ${pedido.pagamento}`)
            if(pedido.descricao){
                doc.fontSize(12).text(`Descrição: ${pedido.descricao}`)
            }
            doc.fontSize(12).text(`Total do Pedido: R$ ${pedido.total.toFixed(2)}`).moveDown()

            doc.end()
    
        } catch (error) {
            console.error("Erro ao gerar o PDF:", error)
            res.status(500).send("Erro ao gerar o PDF")
        }
    }
}

export default Pedido